// Seat Selection & Booking JS
let selectedSeats = [];
let bookingData = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth()) return;

  bookingData = JSON.parse(sessionStorage.getItem('booking_selection'));
  if (!bookingData) {
    Toast.error('No train selected. Please search for trains first.');
    setTimeout(() => window.location.href = '/pages/search.html', 1500);
    return;
  }

  loadSeats();
});

async function loadSeats() {
  const container = document.getElementById('seat-container');
  if (!container) return;

  container.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  try {
    const coaches = await API.get(
      `/trains/${bookingData.train_id}/seats?date=${bookingData.journey_date}&coach_type=${bookingData.coach_type}`
    );

    if (coaches.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"></div>
          <h3>No seats available</h3>
          <p>Try a different coach type or date</p>
        </div>
      `;
      return;
    }

    // Show booking info
    const infoDiv = document.getElementById('booking-info');
    if (infoDiv) {
      infoDiv.innerHTML = `
        <div class="card" style="margin-bottom: 24px;">
          <p><strong>Coach Type:</strong> ${bookingData.coach_type} &nbsp;|&nbsp; 
             <strong>Journey Date:</strong> ${formatDate(bookingData.journey_date)} &nbsp;|&nbsp;
             <strong>Fare per seat:</strong> ${formatCurrency(bookingData.fare)}</p>
        </div>
      `;
    }

    // Render coach tabs
    let html = `
      <div class="seat-legend">
        <div class="seat-legend-item"><div class="seat-legend-box available"></div> Available</div>
        <div class="seat-legend-item"><div class="seat-legend-box selected"></div> Selected</div>
        <div class="seat-legend-item"><div class="seat-legend-box booked"></div> Booked</div>
      </div>
    `;

    coaches.forEach((coach, idx) => {
      const availCount = coach.seats.filter(s => s.status === 'available').length;
      html += `
        <div class="card" style="margin-bottom: 16px;">
          <div class="card-header">
            <div>
              <span class="card-title">${coach.coach_number} — ${coach.coach_type}</span>
              <span class="card-subtitle" style="margin-left: 12px; color: var(--success);">${availCount} seats available</span>
            </div>
          </div>
          <div class="seats-grid">
            ${coach.seats.map(seat => `
              <div class="seat ${seat.status === 'available' ? 'available' : 'booked'}" 
                   data-seat-id="${seat.seat_id}" 
                   data-coach-id="${coach.coach_id}"
                   onclick="${seat.status === 'available' ? `toggleSeat(this, ${seat.seat_id}, '${seat.seat_number}', '${seat.seat_type}')` : ''}">
                <span class="seat-num">${seat.seat_number}</span>
                <span class="seat-type">${seat.seat_type.substring(0, 3)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"></div>
        <h3>Failed to load seats</h3>
        <p>${err.error || 'Please try again'}</p>
      </div>
    `;
  }
}

function toggleSeat(el, seatId, seatNum, seatType) {
  const idx = selectedSeats.findIndex(s => s.seat_id === seatId);
  if (idx >= 0) {
    selectedSeats.splice(idx, 1);
    el.classList.remove('selected');
    el.classList.add('available');
  } else {
    if (selectedSeats.length >= 6) {
      Toast.warning('Maximum 6 seats per booking');
      return;
    }
    selectedSeats.push({ seat_id: seatId, seat_number: seatNum, seat_type: seatType });
    el.classList.add('selected');
    el.classList.remove('available');
  }
  updateSummary();
}

function updateSummary() {
  const summary = document.getElementById('selection-summary');
  if (!summary) return;

  if (selectedSeats.length === 0) {
    summary.innerHTML = '<p style="color: var(--text-muted);">Select seats from the map above</p>';
    return;
  }

  const total = selectedSeats.length * bookingData.fare;

  summary.innerHTML = `
    <div class="card">
      <h3 style="margin-bottom: 16px;">Selected Seats (${selectedSeats.length})</h3>
      ${selectedSeats.map(s => `
        <div style="display:flex; justify-content:space-between; padding: 6px 0; font-size: 0.9rem;">
          <span>Seat ${s.seat_number} (${s.seat_type})</span>
          <span class="amount">${formatCurrency(bookingData.fare)}</span>
        </div>
      `).join('')}
      <div style="border-top: 1px solid var(--border); margin-top: 12px; padding-top: 12px; display: flex; justify-content: space-between;">
        <strong>Total</strong>
        <strong class="amount">${formatCurrency(total)}</strong>
      </div>
      <button class="btn btn-primary btn-lg" style="width: 100%; margin-top: 20px;" onclick="proceedToPassengers()">
        Add Passenger Details →
      </button>
    </div>
  `;
}

function proceedToPassengers() {
  if (selectedSeats.length === 0) {
    Toast.error('Please select at least one seat');
    return;
  }

  // Show passenger form modal
  const modal = document.getElementById('passenger-modal');
  if (!modal) return;

  let formHtml = '';
  selectedSeats.forEach((seat, idx) => {
    formHtml += `
      <div class="card" style="margin-bottom: 16px; padding: 16px;">
        <h4 style="margin-bottom: 12px;">Passenger ${idx + 1} — Seat ${seat.seat_number}</h4>
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input type="text" class="form-input" id="pname-${idx}" required placeholder="Enter full name">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Age</label>
            <input type="number" class="form-input" id="page-${idx}" required min="1" max="120" placeholder="Age">
          </div>
          <div class="form-group">
            <label class="form-label">Gender</label>
            <select class="form-select" id="pgender-${idx}" required>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>
    `;
  });

  document.getElementById('passenger-forms').innerHTML = formHtml;
  modal.classList.add('show');
}

function closePassengerModal() {
  document.getElementById('passenger-modal').classList.remove('show');
}

async function confirmBooking() {
  const passengers = [];
  for (let i = 0; i < selectedSeats.length; i++) {
    const name = document.getElementById(`pname-${i}`).value.trim();
    const age = parseInt(document.getElementById(`page-${i}`).value);
    const gender = document.getElementById(`pgender-${i}`).value;

    if (!name) {
      Toast.error(`Please enter name for passenger ${i + 1}`);
      return;
    }
    if (!age || age < 1) {
      Toast.error(`Please enter valid age for passenger ${i + 1}`);
      return;
    }

    passengers.push({ name, age, gender });
  }

  const btn = document.getElementById('confirm-booking-btn');
  btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Booking...';
  btn.disabled = true;

  try {
    const result = await API.post('/bookings', {
      train_id: bookingData.train_id,
      journey_date: bookingData.journey_date,
      coach_type: bookingData.coach_type,
      source_station_id: bookingData.source_station_id,
      destination_station_id: bookingData.destination_station_id,
      passengers
    });

    Toast.success(`Booking confirmed! PNR: ${result.booking.pnr_number}`);
    closePassengerModal();

    // Store booking for payment page
    sessionStorage.setItem('pending_payment', JSON.stringify({
      booking_id: result.booking.booking_id,
      pnr: result.booking.pnr_number,
      amount: result.booking.total_amount
    }));

    setTimeout(() => {
      window.location.href = '/pages/payment.html';
    }, 1000);
  } catch (err) {
    Toast.error(err.error || 'Booking failed');
    btn.innerHTML = 'Confirm Booking';
    btn.disabled = false;
  }
}
