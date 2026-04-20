const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { authenticate } = require('../middleware/auth');
const { generateTransactionId } = require('../utils/helpers');

// POST /api/payments - Process payment
router.post('/', authenticate, async (req, res) => {
  try {
    const { booking_id, payment_mode } = req.body;

    if (!booking_id || !payment_mode) {
      return res.status(400).json({ error: 'Booking ID and payment mode are required' });
    }

    // Verify booking belongs to user
    const [bookings] = await pool.query(
      'SELECT * FROM bookings WHERE booking_id = ? AND user_id = ?',
      [booking_id, req.user.user_id]
    );

    if (bookings.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookings[0];

    // Check if already paid
    const [existingPayment] = await pool.query(
      "SELECT * FROM payments WHERE booking_id = ? AND status = 'completed'",
      [booking_id]
    );

    if (existingPayment.length > 0) {
      return res.status(400).json({ error: 'Payment already completed for this booking' });
    }

    const transactionId = generateTransactionId();

    // Simulate payment processing (always succeeds in demo)
    const [payment] = await pool.query(
      `INSERT INTO payments (booking_id, amount, status, payment_mode, transaction_id) 
       VALUES (?, ?, 'completed', ?, ?)`,
      [booking_id, booking.total_amount, payment_mode, transactionId]
    );

    // Create notification
    await pool.query(
      `INSERT INTO notifications (user_id, message, type) VALUES (?, ?, 'payment')`,
      [req.user.user_id, `Payment of ₹${booking.total_amount} successful for PNR: ${booking.pnr_number}. Transaction ID: ${transactionId}`]
    );

    res.status(201).json({
      message: 'Payment successful',
      payment: {
        payment_id: payment.insertId,
        transaction_id: transactionId,
        amount: booking.total_amount,
        status: 'completed',
        payment_mode
      }
    });
  } catch (err) {
    console.error('Payment error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/payments/:booking_id - Get payment status
router.get('/:booking_id', authenticate, async (req, res) => {
  try {
    const [payments] = await pool.query(`
      SELECT p.*, b.pnr_number, b.total_amount AS booking_amount
      FROM payments p
      JOIN bookings b ON p.booking_id = b.booking_id
      WHERE p.booking_id = ? AND b.user_id = ?
      ORDER BY p.transaction_date DESC
    `, [req.params.booking_id, req.user.user_id]);

    if (payments.length === 0) {
      return res.status(404).json({ error: 'No payment found for this booking' });
    }

    res.json(payments[0]);
  } catch (err) {
    console.error('Payment status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
