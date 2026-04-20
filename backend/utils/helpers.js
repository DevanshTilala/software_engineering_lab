// Generate a unique PNR number (10-digit)
function generatePNR() {
  const chars = '0123456789';
  let pnr = '';
  for (let i = 0; i < 10; i++) {
    pnr += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pnr;
}

// Generate a unique transaction ID
function generateTransactionId() {
  return 'TXN' + Date.now() + Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Format time to HH:MM
function formatTime(time) {
  if (!time) return '--';
  return time.substring(0, 5);
}

// Calculate fare based on distance and coach type
function calculateFare(distanceKm, farePerKm, passengerCount) {
  const baseFare = distanceKm * farePerKm;
  return Math.round(baseFare * passengerCount * 100) / 100;
}

module.exports = {
  generatePNR,
  generateTransactionId,
  formatTime,
  calculateFare
};
