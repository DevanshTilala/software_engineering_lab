// Coolie Booking Page JS
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth()) return;
  loadCoolieStations();
  loadCoolieBookings();

  const form = document.getElementById('coolie-form');
  if (form) {
    form.addEventListener('submit', handleCoolieBooking);
    // Set minimum date
    const dateInput = document.getElementById('coolie-date');
    if (dateInput) {
      dateInput.min = new Date().toISOString().split('T')[0];
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  }
});

async function loadCoolieStations() {
  try {
    const stations = await API.get('/trains/stations/all');
    const select = document.getElementById('coolie-station');
    if (select) {
      stations.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.station_id;
        opt.textContent = `${s.station_name} (${s.station_code})`;
        select.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Failed to load stations:', err);
  }
}

async function handleCoolieBooking(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Booking...';
  btn.disabled = true;

  try {
    const station_id = document.getElementById('coolie-station').value;
    const booking_date = document.getElementById('coolie-date').value;
    const booking_time = document.getElementById('coolie-time').value;
    const platform_number = document.getElementById('coolie-platform').value;

    if (!station_id) {
      throw { error: 'Please select a station' };
    }

    const result = await API.post('/coolie/book', {
      station_id,
      booking_date,
      booking_time: booking_time || null,
      platform_number: platform_number || null
    });

    Toast.success(`Coolie "${result.booking.coolie_name}" booked! Charge: ₹${result.booking.charge}`);
    e.target.reset();
    document.getElementById('coolie-date').value = new Date().toISOString().split('T')[0];
    loadCoolieBookings();
  } catch (err) {
    Toast.error(err.error || 'Booking failed');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function loadCoolieBookings() {
  const container = document.getElementById('coolie-bookings');
  if (!container) return;

  try {
    const bookings = await API.get('/coolie/bookings');

    if (bookings.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 30px;">
          <div class="empty-icon"></div>
          <h3>No coolie bookings yet</h3>
          <p>Book a coolie for luggage assistance at any station</p>
        </div>
      `;
      return;
    }

    container.innerHTML = bookings.map(b => `
      <div class="coolie-card fade-in">
        <div class="coolie-info">
          <h4> ${b.coolie_name}</h4>
          <p>${b.station_name} (${b.station_code}) ${b.platform_number ? `• Platform ${b.platform_number}` : ''}</p>
          <p>${formatDate(b.booking_date)} ${b.booking_time ? `at ${formatTime(b.booking_time)}` : ''}</p>
        </div>
        <div style="text-align: right;">
          <div class="amount">${formatCurrency(b.charge)}</div>
          ${getStatusBadge(b.status)}
        </div>
      </div>
    `).join('');
  } catch (err) {
    container.innerHTML = '<p style="color: var(--text-muted);">Failed to load bookings</p>';
  }
}
