const express = require('express');
const router = express.Router();
const pool = require('../db/connection');
const { authenticate } = require('../middleware/auth');

// GET /api/trains/search?from=&to=&date=
router.get('/search', async (req, res) => {
  try {
    const { from, to, date } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Source and destination are required' });
    }

    // Find trains that have both stations in their stops, with source before destination
    const [trains] = await pool.query(`
      SELECT DISTINCT t.*, 
        s1.station_name AS source_name, s1.station_code AS source_code,
        s2.station_name AS dest_name, s2.station_code AS dest_code,
        ts1.departure_time AS board_time, ts2.arrival_time AS alight_time,
        ts1.stop_order AS source_order, ts2.stop_order AS dest_order,
        (ts2.distance_km - ts1.distance_km) AS distance_km
      FROM trains t
      JOIN train_stops ts1 ON t.train_id = ts1.train_id
      JOIN stations s1 ON ts1.station_id = s1.station_id
      JOIN train_stops ts2 ON t.train_id = ts2.train_id
      JOIN stations s2 ON ts2.station_id = s2.station_id
      WHERE (LOWER(s1.city) LIKE LOWER(?) OR LOWER(s1.station_name) LIKE LOWER(?) OR LOWER(s1.station_code) = LOWER(?))
        AND (LOWER(s2.city) LIKE LOWER(?) OR LOWER(s2.station_name) LIKE LOWER(?) OR LOWER(s2.station_code) = LOWER(?))
        AND ts1.stop_order < ts2.stop_order
        AND t.is_active = TRUE
      ORDER BY ts1.departure_time
    `, [`%${from}%`, `%${from}%`, from, `%${to}%`, `%${to}%`, to]);

    // For each train, get available seat counts by coach type
    for (let train of trains) {
      const [coaches] = await pool.query(`
        SELECT c.coach_type, c.fare_per_km, COUNT(s.seat_id) AS total_seats,
          COUNT(s.seat_id) - COALESCE(booked.booked_count, 0) AS available_seats
        FROM coaches c
        JOIN seats s ON c.coach_id = s.coach_id
        LEFT JOIN (
          SELECT s2.coach_id, COUNT(*) AS booked_count 
          FROM seat_availability sa
          JOIN seats s2 ON sa.seat_id = s2.seat_id
          WHERE sa.journey_date = ? AND sa.status = 'booked'
          GROUP BY s2.coach_id
        ) booked ON c.coach_id = booked.coach_id
        WHERE c.train_id = ?
        GROUP BY c.coach_type, c.fare_per_km
      `, [date || new Date().toISOString().split('T')[0], train.train_id]);

      train.coaches = coaches.map(c => ({
        ...c,
        fare: Math.round((train.distance_km || 500) * c.fare_per_km)
      }));
    }

    res.json(trains);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trains/:id/schedule
router.get('/:id/schedule', async (req, res) => {
  try {
    const [train] = await pool.query(`
      SELECT t.*, s1.station_name AS source_name, s2.station_name AS dest_name
      FROM trains t
      JOIN stations s1 ON t.source_station_id = s1.station_id
      JOIN stations s2 ON t.destination_station_id = s2.station_id
      WHERE t.train_id = ?
    `, [req.params.id]);

    if (train.length === 0) {
      return res.status(404).json({ error: 'Train not found' });
    }

    const [stops] = await pool.query(`
      SELECT ts.*, s.station_name, s.station_code, s.city
      FROM train_stops ts
      JOIN stations s ON ts.station_id = s.station_id
      WHERE ts.train_id = ?
      ORDER BY ts.stop_order
    `, [req.params.id]);

    res.json({ train: train[0], stops });
  } catch (err) {
    console.error('Schedule error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trains/:id/seats?date=&coach_type=
router.get('/:id/seats', async (req, res) => {
  try {
    const { date, coach_type } = req.query;
    const journeyDate = date || new Date().toISOString().split('T')[0];

    let query = `
      SELECT c.coach_id, c.coach_number, c.coach_type, c.fare_per_km,
        s.seat_id, s.seat_number, s.seat_type,
        COALESCE(sa.status, 'available') AS availability_status
      FROM coaches c
      JOIN seats s ON c.coach_id = s.coach_id
      LEFT JOIN seat_availability sa ON s.seat_id = sa.seat_id AND sa.journey_date = ?
      WHERE c.train_id = ?
    `;
    const params = [journeyDate, req.params.id];

    if (coach_type) {
      query += ' AND c.coach_type = ?';
      params.push(coach_type);
    }

    query += ' ORDER BY c.coach_type, c.coach_number, CAST(s.seat_number AS UNSIGNED)';

    const [seats] = await pool.query(query, params);

    // Group by coach
    const coachMap = {};
    seats.forEach(s => {
      if (!coachMap[s.coach_id]) {
        coachMap[s.coach_id] = {
          coach_id: s.coach_id,
          coach_number: s.coach_number,
          coach_type: s.coach_type,
          fare_per_km: s.fare_per_km,
          seats: []
        };
      }
      coachMap[s.coach_id].seats.push({
        seat_id: s.seat_id,
        seat_number: s.seat_number,
        seat_type: s.seat_type,
        status: s.availability_status
      });
    });

    res.json(Object.values(coachMap));
  } catch (err) {
    console.error('Seats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trains/:id/status
router.get('/:id/status', async (req, res) => {
  try {
    const [status] = await pool.query(`
      SELECT ts.*, t.train_name, t.train_number
      FROM train_status ts
      JOIN trains t ON ts.train_id = t.train_id
      WHERE ts.train_id = ?
    `, [req.params.id]);

    if (status.length === 0) {
      return res.status(404).json({ error: 'Status not found for this train' });
    }

    const [stops] = await pool.query(`
      SELECT ts.*, s.station_name, s.station_code
      FROM train_stops ts
      JOIN stations s ON ts.station_id = s.station_id
      WHERE ts.train_id = ?
      ORDER BY ts.stop_order
    `, [req.params.id]);

    res.json({ status: status[0], stops });
  } catch (err) {
    console.error('Status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trains/stations/all
router.get('/stations/all', async (req, res) => {
  try {
    const [stations] = await pool.query('SELECT * FROM stations ORDER BY station_name');
    res.json(stations);
  } catch (err) {
    console.error('Stations error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
