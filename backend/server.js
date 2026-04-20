const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/trains', require('./routes/trains'));
app.use('/api/bookings', require('./routes/booking'));
app.use('/api/payments', require('./routes/payment'));
app.use('/api/coolie', require('./routes/coolie'));
app.use('/api/notifications', require('./routes/notification'));
app.use('/api/admin', require('./routes/admin'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Fallback to frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n[Railway Management System Server]`);
  console.log(`[SERVER] Running on http://localhost:${PORT}`);
  console.log(`[API] Available at http://localhost:${PORT}/api`);
  console.log(`[FRONTEND] Serving at http://localhost:${PORT}\n`);
});
