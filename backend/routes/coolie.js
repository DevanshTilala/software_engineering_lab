const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { authenticate } = require('../middleware/auth');

const coolieNames = [
  'Ramesh Kumar', 'Suresh Singh', 'Mohan Lal', 'Arun Yadav', 'Vijay Sharma',
  'Deepak Verma', 'Rajesh Gupta', 'Manoj Tiwari', 'Sanjay Patel', 'Amit Chauhan'
];

// POST /api/coolie/book - Book coolie service
router.post('/book', authenticate, async (req, res) => {
  try {
    const { station_id, booking_date, booking_time, platform_number } = req.body;

    if (!station_id || !booking_date) {
      return res.status(400).json({ error: 'Station and booking date are required' });
    }

    // Assign a random coolie
    const coolieName = coolieNames[Math.floor(Math.random() * coolieNames.length)];
    const charge = 150.00;

    const [result] = await pool.query(
      `INSERT INTO coolie_bookings (user_id, station_id, coolie_name, charge, status, booking_date, booking_time, platform_number) 
       VALUES (?, ?, ?, ?, 'confirmed', ?, ?, ?)`,
      [req.user.user_id, station_id, coolieName, charge, booking_date, booking_time || null, platform_number || null]
    );

    // Notification
    const [station] = await pool.query('SELECT station_name FROM stations WHERE station_id = ?', [station_id]);
    await pool.query(
      `INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'general')`,
      [req.user.user_id, `Coolie ${coolieName} booked at ${station[0]?.station_name || 'station'} on ${booking_date}. Charge: ₹${charge}`]
    );

    res.status(201).json({
      message: 'Coolie booked successfully',
      booking: {
        coolie_booking_id: result.insertId,
        coolie_name: coolieName,
        charge,
        status: 'confirmed',
        booking_date,
        platform_number
      }
    });
  } catch (err) {
    console.error('Coolie booking error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/coolie/bookings - Get user's coolie bookings
router.get('/bookings', authenticate, async (req, res) => {
  try {
    const [bookings] = await pool.query(`
      SELECT cb.*, s.station_name, s.station_code
      FROM coolie_bookings cb
      JOIN stations s ON cb.station_id = s.station_id
      WHERE cb.user_id = ?
      ORDER BY cb.booking_date DESC
    `, [req.user.user_id]);

    res.json(bookings);
  } catch (err) {
    console.error('Get coolie bookings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
