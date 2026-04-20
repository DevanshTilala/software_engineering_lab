const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: __dirname + '/../.env' });

async function initDatabase() {
  // Connect without database first to create it if needed
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT) || 3306,
    multipleStatements: true
  });

  console.log('[DB] Connected to MySQL server');

  // Create database
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${process.env.DB_NAME || 'railway_management'}\``);
  await connection.query(`USE \`${process.env.DB_NAME || 'railway_management'}\``);
  console.log('[DB] Database ready');

  // Drop existing tables (reverse order to respect foreign keys)
  console.log('[SETUP] Dropping existing tables for clean setup...');
  await connection.query(`
    SET FOREIGN_KEY_CHECKS = 0;
    DROP TABLE IF EXISTS seat_availability;
    DROP TABLE IF EXISTS train_status;
    DROP TABLE IF EXISTS notifications;
    DROP TABLE IF EXISTS coolie_bookings;
    DROP TABLE IF EXISTS payments;
    DROP TABLE IF EXISTS booking_passengers;
    DROP TABLE IF EXISTS bookings;
    DROP TABLE IF EXISTS seats;
    DROP TABLE IF EXISTS coaches;
    DROP TABLE IF EXISTS train_stops;
    DROP TABLE IF EXISTS trains;
    DROP TABLE IF EXISTS stations;
    DROP TABLE IF EXISTS passengers;
    DROP TABLE IF EXISTS users;
    SET FOREIGN_KEY_CHECKS = 1;
  `);
  console.log('[OK] Old tables dropped');

  // Create tables
  const tables = `
    CREATE TABLE IF NOT EXISTS users (
      user_id INT PRIMARY KEY AUTO_INCREMENT,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      phone VARCHAR(15),
      password VARCHAR(255) NOT NULL,
      role ENUM('user', 'admin') DEFAULT 'user',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS passengers (
      passenger_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      name VARCHAR(100) NOT NULL,
      age INT NOT NULL,
      gender ENUM('Male', 'Female', 'Other') NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stations (
      station_id INT PRIMARY KEY AUTO_INCREMENT,
      station_name VARCHAR(100) NOT NULL,
      station_code VARCHAR(10) UNIQUE NOT NULL,
      city VARCHAR(100) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS trains (
      train_id INT PRIMARY KEY AUTO_INCREMENT,
      train_name VARCHAR(150) NOT NULL,
      train_number VARCHAR(10) UNIQUE NOT NULL,
      source_station_id INT NOT NULL,
      destination_station_id INT NOT NULL,
      departure_time TIME NOT NULL,
      arrival_time TIME NOT NULL,
      runs_on VARCHAR(50) DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat,Sun',
      is_active BOOLEAN DEFAULT TRUE,
      FOREIGN KEY (source_station_id) REFERENCES stations(station_id),
      FOREIGN KEY (destination_station_id) REFERENCES stations(station_id)
    );

    CREATE TABLE IF NOT EXISTS train_stops (
      stop_id INT PRIMARY KEY AUTO_INCREMENT,
      train_id INT NOT NULL,
      station_id INT NOT NULL,
      arrival_time TIME,
      departure_time TIME,
      stop_order INT NOT NULL,
      distance_km INT DEFAULT 0,
      FOREIGN KEY (train_id) REFERENCES trains(train_id) ON DELETE CASCADE,
      FOREIGN KEY (station_id) REFERENCES stations(station_id)
    );

    CREATE TABLE IF NOT EXISTS coaches (
      coach_id INT PRIMARY KEY AUTO_INCREMENT,
      train_id INT NOT NULL,
      coach_number VARCHAR(10) NOT NULL,
      coach_type ENUM('SL', '3A', '2A', '1A', 'CC', '2S') NOT NULL,
      total_seats INT NOT NULL,
      fare_per_km DECIMAL(5,2) DEFAULT 1.00,
      FOREIGN KEY (train_id) REFERENCES trains(train_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS seats (
      seat_id INT PRIMARY KEY AUTO_INCREMENT,
      coach_id INT NOT NULL,
      seat_number VARCHAR(10) NOT NULL,
      seat_type ENUM('Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper', 'Window', 'Aisle') DEFAULT 'Lower',
      FOREIGN KEY (coach_id) REFERENCES coaches(coach_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      booking_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      train_id INT NOT NULL,
      booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      journey_date DATE NOT NULL,
      status ENUM('confirmed', 'cancelled', 'waiting', 'completed') DEFAULT 'confirmed',
      pnr_number VARCHAR(10) UNIQUE NOT NULL,
      total_amount DECIMAL(10,2) NOT NULL,
      source_station_id INT,
      destination_station_id INT,
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      FOREIGN KEY (train_id) REFERENCES trains(train_id),
      FOREIGN KEY (source_station_id) REFERENCES stations(station_id),
      FOREIGN KEY (destination_station_id) REFERENCES stations(station_id)
    );

    CREATE TABLE IF NOT EXISTS booking_passengers (
      id INT PRIMARY KEY AUTO_INCREMENT,
      booking_id INT NOT NULL,
      passenger_name VARCHAR(100) NOT NULL,
      passenger_age INT NOT NULL,
      passenger_gender ENUM('Male', 'Female', 'Other') NOT NULL,
      seat_id INT,
      status ENUM('confirmed', 'cancelled', 'waiting') DEFAULT 'confirmed',
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE,
      FOREIGN KEY (seat_id) REFERENCES seats(seat_id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      payment_id INT PRIMARY KEY AUTO_INCREMENT,
      booking_id INT NOT NULL,
      amount DECIMAL(10,2) NOT NULL,
      status ENUM('pending', 'completed', 'refunded', 'failed') DEFAULT 'pending',
      payment_mode ENUM('credit_card', 'debit_card', 'upi', 'net_banking', 'wallet') NOT NULL,
      transaction_id VARCHAR(50),
      transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
    );

    CREATE TABLE IF NOT EXISTS coolie_bookings (
      coolie_booking_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      station_id INT NOT NULL,
      coolie_name VARCHAR(100),
      charge DECIMAL(8,2) DEFAULT 150.00,
      status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
      booking_date DATE NOT NULL,
      booking_time TIME,
      platform_number VARCHAR(5),
      FOREIGN KEY (user_id) REFERENCES users(user_id),
      FOREIGN KEY (station_id) REFERENCES stations(station_id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      notification_id INT PRIMARY KEY AUTO_INCREMENT,
      user_id INT NOT NULL,
      message TEXT NOT NULL,
      type ENUM('booking', 'cancellation', 'delay', 'general', 'payment') DEFAULT 'general',
      is_read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS train_status (
      status_id INT PRIMARY KEY AUTO_INCREMENT,
      train_id INT NOT NULL,
      current_station VARCHAR(100),
      delay_minutes INT DEFAULT 0,
      status ENUM('on_time', 'delayed', 'cancelled', 'arrived', 'departed') DEFAULT 'on_time',
      last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (train_id) REFERENCES trains(train_id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS seat_availability (
      availability_id INT PRIMARY KEY AUTO_INCREMENT,
      seat_id INT NOT NULL,
      journey_date DATE NOT NULL,
      status ENUM('available', 'booked', 'waiting') DEFAULT 'available',
      booking_id INT,
      UNIQUE KEY unique_seat_date (seat_id, journey_date),
      FOREIGN KEY (seat_id) REFERENCES seats(seat_id) ON DELETE CASCADE,
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
    );
  `;

  await connection.query(tables);
  console.log('[OK] All tables created');

  // Seed data
  // 1. Admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const userPassword = await bcrypt.hash('user123', 10);
  
  await connection.query(`
    INSERT IGNORE INTO users (name, email, phone, password, role) VALUES
    ('Admin', 'admin@railway.com', '9999999999', '${hashedPassword}', 'admin'),
    ('Devansh', 'devansh@test.com', '9876543210', '${userPassword}', 'user'),
    ('Priya Sharma', 'priya@test.com', '9876543211', '${userPassword}', 'user')
  `);
  console.log('[OK] Users seeded');

  // 2. Stations
  await connection.query(`
    INSERT IGNORE INTO stations (station_name, station_code, city) VALUES
    ('New Delhi', 'NDLS', 'New Delhi'),
    ('Mumbai Central', 'MMCT', 'Mumbai'),
    ('Chennai Central', 'MAS', 'Chennai'),
    ('Howrah Junction', 'HWH', 'Kolkata'),
    ('Bengaluru City', 'SBC', 'Bengaluru'),
    ('Ahmedabad Junction', 'ADI', 'Ahmedabad'),
    ('Jaipur Junction', 'JP', 'Jaipur'),
    ('Lucknow', 'LKO', 'Lucknow'),
    ('Hyderabad Deccan', 'HYB', 'Hyderabad'),
    ('Pune Junction', 'PUNE', 'Pune'),
    ('Bhopal Junction', 'BPL', 'Bhopal'),
    ('Kanpur Central', 'CNB', 'Kanpur'),
    ('Agra Cantt', 'AGC', 'Agra'),
    ('Varanasi Junction', 'BSB', 'Varanasi'),
    ('Patna Junction', 'PNBE', 'Patna')
  `);
  console.log('[OK] Stations seeded');

  // 3. Trains
  await connection.query(`
    INSERT IGNORE INTO trains (train_name, train_number, source_station_id, destination_station_id, departure_time, arrival_time, runs_on) VALUES
    ('Rajdhani Express', '12301', 1, 4, '16:55', '09:55', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun'),
    ('Shatabdi Express', '12001', 1, 7, '06:05', '10:30', 'Mon,Tue,Wed,Thu,Fri,Sat'),
    ('Duronto Express', '12213', 1, 2, '23:00', '15:40', 'Mon,Wed,Fri'),
    ('Garib Rath', '12909', 1, 6, '15:55', '05:40', 'Tue,Thu,Sat'),
    ('Vande Bharat Express', '22435', 1, 14, '06:00', '14:00', 'Mon,Tue,Wed,Thu,Fri,Sat'),
    ('Tamil Nadu Express', '12621', 1, 3, '22:30', '05:15', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun'),
    ('Karnataka Express', '12627', 1, 5, '21:15', '06:40', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun'),
    ('Mumbai Rajdhani', '12951', 1, 2, '16:25', '08:15', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun'),
    ('Deccan Queen', '12123', 2, 10, '07:15', '10:30', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun'),
    ('Howrah Mail', '12809', 2, 4, '21:00', '23:30', 'Mon,Tue,Wed,Thu,Fri,Sat,Sun')
  `);
  console.log('[OK] Trains seeded');

  // 4. Train stops
  await connection.query(`
    INSERT IGNORE INTO train_stops (train_id, station_id, arrival_time, departure_time, stop_order, distance_km) VALUES
    (1, 1, NULL, '16:55', 1, 0),
    (1, 12, '21:30', '21:35', 2, 440),
    (1, 14, '01:10', '01:20', 3, 765),
    (1, 15, '05:15', '05:25', 4, 995),
    (1, 4, '09:55', NULL, 5, 1450),
    
    (2, 1, NULL, '06:05', 1, 0),
    (2, 13, '08:10', '08:12', 2, 195),
    (2, 7, '10:30', NULL, 3, 310),
    
    (3, 1, NULL, '23:00', 1, 0),
    (3, 2, '15:40', NULL, 2, 1384),
    
    (8, 1, NULL, '16:25', 1, 0),
    (8, 11, '23:30', '23:35', 2, 700),
    (8, 2, '08:15', NULL, 3, 1384)
  `);
  console.log('[OK] Train stops seeded');

  // 5. Coaches and seats for each train
  const coachTypes = [
    { type: '1A', seats: 18, fare: 4.00, prefix: 'H' },
    { type: '2A', seats: 36, fare: 2.50, prefix: 'A' },
    { type: '3A', seats: 54, fare: 1.50, prefix: 'B' },
    { type: 'SL', seats: 72, fare: 0.75, prefix: 'S' },
  ];

  const seatTypes = ['Lower', 'Middle', 'Upper', 'Side Lower', 'Side Upper', 'Lower'];

  for (let trainId = 1; trainId <= 10; trainId++) {
    for (const coach of coachTypes) {
      const coachNum = `${coach.prefix}1`;
      const [result] = await connection.query(
        `INSERT IGNORE INTO coaches (train_id, coach_number, coach_type, total_seats, fare_per_km) VALUES (?, ?, ?, ?, ?)`,
        [trainId, coachNum, coach.type, coach.seats, coach.fare]
      );
      
      if (result.insertId) {
        const seatValues = [];
        for (let s = 1; s <= coach.seats; s++) {
          const seatType = seatTypes[(s - 1) % seatTypes.length];
          seatValues.push(`(${result.insertId}, '${s}', '${seatType}')`);
        }
        if (seatValues.length > 0) {
          await connection.query(`INSERT IGNORE INTO seats (coach_id, seat_number, seat_type) VALUES ${seatValues.join(',')}`);
        }
      }
    }
  }
  console.log('[OK] Coaches & seats seeded');

  // 6. Train status
  await connection.query(`
    INSERT IGNORE INTO train_status (train_id, current_station, delay_minutes, status) VALUES
    (1, 'New Delhi', 0, 'on_time'),
    (2, 'Agra Cantt', 5, 'delayed'),
    (3, 'New Delhi', 0, 'on_time'),
    (8, 'Bhopal Junction', 15, 'delayed'),
    (9, 'Mumbai Central', 0, 'on_time'),
    (10, 'Mumbai Central', 0, 'departed')
  `);
  console.log('[OK] Train status seeded');

  console.log('\n[SUCCESS] Database initialization complete!');
  console.log('[INFO] Admin login: admin@railway.com / admin123');
  console.log('[INFO] User login: devansh@test.com / user123');
  
  await connection.end();
  process.exit(0);
}

initDatabase().catch(err => {
  console.error('[ERROR] Database initialization failed:', err);
  process.exit(1);
});
