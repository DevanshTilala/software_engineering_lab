const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { authenticate } = require('../middleware/auth');
const { generatePNR, calculateFare } = require('../utils/helpers');

// POST /api/bookings - Create a booking
router.post('/', authenticate, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { train_id, journey_date, coach_type, source_station_id, destination_station_id, passengers } = req.body;

    if (!train_id || !journey_date || !coach_type || !passengers || passengers.length === 0) {
      return res.status(400).json({ error: 'Missing required booking details' });
    }

    // Get coach and fare info
    const [coaches] = await conn.query(
      'SELECT * FROM coaches WHERE train_id = ? AND coach_type = ?',
      [train_id, coach_type]
    );
    if (coaches.length === 0) {
      return res.status(400).json({ error: 'Coach type not available for this train' });
    }

    const coach = coaches[0];

    // Get distance for fare calculation
    let distance = 500; // default
    if (source_station_id && destination_station_id) {
      const [stops] = await conn.query(`
        SELECT ts1.distance_km AS src_dist, ts2.distance_km AS dest_dist
        FROM train_stops ts1, train_stops ts2
        WHERE ts1.train_id = ? AND ts2.train_id = ?
          AND ts1.station_id = ? AND ts2.station_id = ?
      `, [train_id, train_id, source_station_id, destination_station_id]);
      if (stops.length > 0) {
        distance = Math.abs(stops[0].dest_dist - stops[0].src_dist) || 500;
      }
    }

    const totalAmount = calculateFare(distance, coach.fare_per_km, passengers.length);

    // Find available seats
    const [availableSeats] = await conn.query(`
      SELECT s.seat_id FROM seats s
      WHERE s.coach_id = ?
        AND s.seat_id NOT IN (
          SELECT sa.seat_id FROM seat_availability sa 
          WHERE sa.journey_date = ? AND sa.status = 'booked'
        )
      LIMIT ?
    `, [coach.coach_id, journey_date, passengers.length]);

    if (availableSeats.length < passengers.length) {
      await conn.rollback();
      return res.status(400).json({ error: `Only ${availableSeats.length} seats available. Requested ${passengers.length}.` });
    }

    // Generate PNR
    let pnr;
    let pnrExists = true;
    while (pnrExists) {
      pnr = generatePNR();
      const [check] = await conn.query('SELECT booking_id FROM bookings WHERE pnr_number = ?', [pnr]);
      pnrExists = check.length > 0;
    }

    // Create booking
    const [booking] = await conn.query(
      `INSERT INTO bookings (user_id, train_id, journey_date, status, pnr_number, total_amount, source_station_id, destination_station_id)
       VALUES (?, ?, ?, 'confirmed', ?, ?, ?, ?)`,
      [req.user.user_id, train_id, journey_date, pnr, totalAmount, source_station_id || null, destination_station_id || null]
    );

    // Add passengers and book seats
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      const seatId = availableSeats[i].seat_id;

      await conn.query(
        `INSERT INTO booking_passengers (booking_id, passenger_name, passenger_age, passenger_gender, seat_id, status)
         VALUES (?, ?, ?, ?, ?, 'confirmed')`,
        [booking.insertId, p.name, p.age, p.gender, seatId]
      );

      // Mark seat as booked
      await conn.query(
        `INSERT INTO seat_availability (seat_id, journey_date, status, booking_id) VALUES (?, ?, 'booked', ?)
         ON DUPLICATE KEY UPDATE status = 'booked', booking_id = ?`,
        [seatId, journey_date, booking.insertId, booking.insertId]
      );
    }

    // Create notification
    await conn.query(
      `INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'booking')`,
      [req.user.user_id, `Booking confirmed! PNR: ${pnr}. Journey on ${journey_date}. Amount: ₹${totalAmount}`]
    );

    await conn.commit();

    res.status(201).json({
      message: 'Booking confirmed',
      booking: {
        booking_id: booking.insertId,
        pnr_number: pnr,
        total_amount: totalAmount,
        journey_date,
        status: 'confirmed',
        passengers_count: passengers.length
      }
    });
  } catch (err) {
    await conn.rollback();
    console.error('Booking error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

// GET /api/bookings - Get user's bookings
router.get('/', authenticate, async (req, res) => {
  try {
    const [bookings] = await pool.query(`
      SELECT b.*, t.train_name, t.train_number,
        s1.station_name AS source_name, s1.station_code AS source_code,
        s2.station_name AS dest_name, s2.station_code AS dest_code
      FROM bookings b
      JOIN trains t ON b.train_id = t.train_id
      LEFT JOIN stations s1 ON b.source_station_id = s1.station_id
      LEFT JOIN stations s2 ON b.destination_station_id = s2.station_id
      WHERE b.user_id = ?
      ORDER BY b.booking_date DESC
    `, [req.user.user_id]);

    // Get passengers for each booking
    for (let booking of bookings) {
      const [passengers] = await pool.query(`
        SELECT bp.*, s.seat_number, s.seat_type, c.coach_number, c.coach_type
        FROM booking_passengers bp
        LEFT JOIN seats s ON bp.seat_id = s.seat_id
        LEFT JOIN coaches c ON s.coach_id = c.coach_id
        WHERE bp.booking_id = ?
      `, [booking.booking_id]);
      booking.passengers = passengers;
    }

    res.json(bookings);
  } catch (err) {
    console.error('Get bookings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/bookings/:id - Get booking details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [bookings] = await pool.query(`
      SELECT b.*, t.train_name, t.train_number,
        s1.station_name AS source_name, s2.station_name AS dest_name
      FROM bookings b
      JOIN trains t ON b.train_id = t.train_id
      LEFT JOIN stations s1 ON b.source_station_id = s1.station_id
      LEFT JOIN stations s2 ON b.destination_station_id = s2.station_id
      WHERE b.booking_id = ? AND b.user_id = ?
    `, [req.params.id, req.user.user_id]);

    if (bookings.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const [passengers] = await pool.query(`
      SELECT bp.*, s.seat_number, s.seat_type, c.coach_number, c.coach_type
      FROM booking_passengers bp
      LEFT JOIN seats s ON bp.seat_id = s.seat_id
      LEFT JOIN coaches c ON s.coach_id = c.coach_id
      WHERE bp.booking_id = ?
    `, [req.params.id]);

    const [payments] = await pool.query(
      'SELECT * FROM payments WHERE booking_id = ?',
      [req.params.id]
    );

    res.json({ ...bookings[0], passengers, payments });
  } catch (err) {
    console.error('Booking details error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/bookings/:id/cancel - Cancel booking
router.put('/:id/cancel', authenticate, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [bookings] = await conn.query(
      'SELECT * FROM bookings WHERE booking_id = ? AND user_id = ?',
      [req.params.id, req.user.user_id]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (bookings[0].status === 'cancelled') {
      return res.status(400).json({ error: 'Booking already cancelled' });
    }

    // Update booking status
    await conn.query(
      'UPDATE bookings SET status = ? WHERE booking_id = ?',
      ['cancelled', req.params.id]
    );

    // Release seats
    await conn.query(
      'DELETE FROM seat_availability WHERE booking_id = ?',
      [req.params.id]
    );

    // Update passenger status
    await conn.query(
      'UPDATE booking_passengers SET status = ? WHERE booking_id = ?',
      ['cancelled', req.params.id]
    );

    // Refund payment
    await conn.query(
      `UPDATE payments SET status = 'refunded' WHERE booking_id = ? AND status = 'completed'`,
      [req.params.id]
    );

    // Create notification
    await conn.query(
      `INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'cancellation')`,
      [req.user.user_id, `Booking ${bookings[0].pnr_number} cancelled. Refund of ₹${bookings[0].total_amount} will be processed within 5-7 business days.`]
    );

    await conn.commit();

    res.json({ message: 'Booking cancelled successfully', refund_amount: bookings[0].total_amount });
  } catch (err) {
    await conn.rollback();
    console.error('Cancel error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});

module.exports = router;
