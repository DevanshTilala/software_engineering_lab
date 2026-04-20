const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { authenticate, isAdmin } = require('../middleware/auth');

// All admin routes require authentication + admin role
router.use(authenticate, isAdmin);

// POST /api/admin/trains - Add a new train
router.post('/trains', async (req, res) => {
  try {
    const { train_name, train_number, source_station_id, destination_station_id, departure_time, arrival_time, runs_on, coaches: coachList } = req.body;

    if (!train_name || !train_number || !source_station_id || !destination_station_id) {
      return res.status(400).json({ error: 'Missing required train details' });
    }

    const [result] = await pool.query(
      `INSERT INTO trains (train_name, train_number, source_station_id, destination_station_id, departure_time, arrival_time, runs_on) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [train_name, train_number, source_station_id, destination_station_id, departure_time || '06:00', arrival_time || '18:00', runs_on || 'Mon,Tue,Wed,Thu,Fri,Sat,Sun']
    );

    // Add default coaches if not provided
    if (!coachList || coachList.length === 0) {
      const defaultCoaches = [
        { type: '1A', num: 'H1', seats: 18, fare: 4.00 },
        { type: '2A', num: 'A1', seats: 36, fare: 2.50 },
        { type: '3A', num: 'B1', seats: 54, fare: 1.50 },
        { type: 'SL', num: 'S1', seats: 72, fare: 0.75 },
      ];
      for (const c of defaultCoaches) {
        const [coachResult] = await pool.query(
          'INSERT INTO coaches (train_id, coach_number, coach_type, total_seats, fare_per_km) VALUES (?, ?, ?, ?, ?)',
          [result.insertId, c.num, c.type, c.seats, c.fare]
        );
        // Add seats
        const seatTypes = ['Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper', 'Lower'];
        for (let s = 1; s <= c.seats; s++) {
          await pool.query(
            'INSERT INTO seats (coach_id, seat_number, seat_type) VALUES (?, ?, ?)',
            [coachResult.insertId, s.toString(), seatTypes[(s - 1) % seatTypes.length]]
          );
        }
      }
    }

    // Add train status
    await pool.query(
      `INSERT INTO train_status (train_id, current_station, delay_minutes, status) VALUES (?, 'Origin', 0, 'on_time')`,
      [result.insertId]
    );

    res.status(201).json({ message: 'Train added successfully', train_id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Train number already exists' });
    }
    console.error('Add train error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/trains/:id - Update train
router.put('/trains/:id', async (req, res) => {
  try {
    const { train_name, departure_time, arrival_time, runs_on, is_active } = req.body;
    
    const updates = [];
    const values = [];

    if (train_name) { updates.push('train_name = ?'); values.push(train_name); }
    if (departure_time) { updates.push('departure_time = ?'); values.push(departure_time); }
    if (arrival_time) { updates.push('arrival_time = ?'); values.push(arrival_time); }
    if (runs_on) { updates.push('runs_on = ?'); values.push(runs_on); }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.id);
    await pool.query(`UPDATE trains SET ${updates.join(', ')} WHERE train_id = ?`, values);

    res.json({ message: 'Train updated successfully' });
  } catch (err) {
    console.error('Update train error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/trains/:id - Delete train
router.delete('/trains/:id', async (req, res) => {
  try {
    // Check for active bookings
    const [bookings] = await pool.query(
      "SELECT COUNT(*) AS count FROM bookings WHERE train_id = ? AND status = 'confirmed'",
      [req.params.id]
    );

    if (bookings[0].count > 0) {
      return res.status(400).json({ error: `Cannot delete train. ${bookings[0].count} active bookings exist.` });
    }

    await pool.query('DELETE FROM trains WHERE train_id = ?', [req.params.id]);
    res.json({ message: 'Train deleted successfully' });
  } catch (err) {
    console.error('Delete train error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/admin/trains/:id/status - Update train status
router.put('/trains/:id/status', async (req, res) => {
  try {
    const { current_station, delay_minutes, status } = req.body;

    await pool.query(
      `UPDATE train_status SET current_station = ?, delay_minutes = ?, status = ? WHERE train_id = ?`,
      [current_station, delay_minutes || 0, status || 'on_time', req.params.id]
    );

    // Notify users with bookings on this train
    if (delay_minutes > 0 || status === 'cancelled') {
      const [bookings] = await pool.query(
        "SELECT DISTINCT user_id FROM bookings WHERE train_id = ? AND status = 'confirmed'",
        [req.params.id]
      );

      const [train] = await pool.query('SELECT train_name, train_number FROM trains WHERE train_id = ?', [req.params.id]);
      const trainInfo = train[0];

      for (const b of bookings) {
        const msg = status === 'cancelled'
          ? `Train ${trainInfo.train_number} (${trainInfo.train_name}) has been CANCELLED.`
          : `Train ${trainInfo.train_number} (${trainInfo.train_name}) is delayed by ${delay_minutes} minutes at ${current_station}.`;

        await pool.query(
          `INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'delay')`,
          [b.user_id, msg]
        );
      }
    }

    res.json({ message: 'Train status updated' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/bookings - View all bookings
router.get('/bookings', async (req, res) => {
  try {
    const [bookings] = await pool.query(`
      SELECT b.*, t.train_name, t.train_number, u.name AS user_name, u.email AS user_email,
        s1.station_name AS source_name, s2.station_name AS dest_name
      FROM bookings b
      JOIN trains t ON b.train_id = t.train_id
      JOIN users u ON b.user_id = u.user_id
      LEFT JOIN stations s1 ON b.source_station_id = s1.station_id
      LEFT JOIN stations s2 ON b.destination_station_id = s2.station_id
      ORDER BY b.booking_date DESC
      LIMIT 100
    `);
    res.json(bookings);
  } catch (err) {
    console.error('Admin bookings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/trains - List all trains
router.get('/trains', async (req, res) => {
  try {
    const [trains] = await pool.query(`
      SELECT t.*, s1.station_name AS source_name, s2.station_name AS dest_name,
        ts.status AS current_status, ts.delay_minutes, ts.current_station AS live_station
      FROM trains t
      JOIN stations s1 ON t.source_station_id = s1.station_id
      JOIN stations s2 ON t.destination_station_id = s2.station_id
      LEFT JOIN train_status ts ON t.train_id = ts.train_id
      ORDER BY t.train_number
    `);
    res.json(trains);
  } catch (err) {
    console.error('Admin trains error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/stats - Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const [userCount] = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'user'");
    const [trainCount] = await pool.query('SELECT COUNT(*) AS count FROM trains');
    const [bookingCount] = await pool.query('SELECT COUNT(*) AS count FROM bookings');
    const [revenue] = await pool.query("SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE status = 'completed'");
    const [todayBookings] = await pool.query(
      "SELECT COUNT(*) AS count FROM bookings WHERE DATE(booking_date) = CURDATE()"
    );
    const [cancelledCount] = await pool.query("SELECT COUNT(*) AS count FROM bookings WHERE status = 'cancelled'");

    res.json({
      total_users: userCount[0].count,
      total_trains: trainCount[0].count,
      total_bookings: bookingCount[0].count,
      total_revenue: revenue[0].total,
      today_bookings: todayBookings[0].count,
      cancelled_bookings: cancelledCount[0].count
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
