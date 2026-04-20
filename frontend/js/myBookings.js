// My Bookings Page JS
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth()) return;
  loadBookings();
});

async function loadBookings() {
  const container = document.getElementById('bookings-container');
  if (!container) return;

  container.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  try {
    const bookings = await API.get('/bookings');

    if (bookings.length === 0) {
      container.innerHTML = `
        <div class="empty-state fade-in">
          <div class="empty-icon">--</div>
          <h3>No bookings yet</h3>
          <p>Search for trains and book your first ticket!</p>
          <a href="/pages/search.html" class="btn btn-primary" style="margin-top: 16px;">Search Trains</a>
        </div>
      `;
      return;
    }

    container.innerHTML = bookings.map(booking => renderBookingCard(booking)).join('');
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">!</div>
        <h3>Failed to load bookings</h3>
        <p>${err.error || 'Please try again'}</p>
      </div>
    `;
  }
}

function renderBookingCard(booking) {
  return `
    <div class="ticket-card fade-in">
      <div class="ticket-header">
        <div class="ticket-pnr">PNR: <span>${booking.pnr_number}</span></div>
        ${getStatusBadge(booking.status)}
      </div>
      <div class="ticket-body">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px;">
          <div>
            <h3 style="font-family: var(--font-heading); font-weight: 700;">${booking.train_name}</h3>
            <span style="color: var(--text-muted); font-size: 0.85rem;">#${booking.train_number}</span>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.85rem; color: var(--text-secondary);">Journey Date</div>
            <div style="font-weight: 600;">${formatDate(booking.journey_date)}</div>
          </div>
        </div>

        <div class="ticket-route">
          <div class="train-station">
            <div class="name">${booking.source_name || 'Source'} ${booking.source_code ? `(${booking.source_code})` : ''}</div>
          </div>
          <div style="color: var(--text-muted); font-size: 1.2rem;">→</div>
          <div class="train-station dest">
            <div class="name">${booking.dest_name || 'Destination'} ${booking.dest_code ? `(${booking.dest_code})` : ''}</div>
          </div>
        </div>

        ${booking.passengers && booking.passengers.length > 0 ? `
          <div class="ticket-passengers">
            <h4 style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 8px;">PASSENGERS</h4>
            ${booking.passengers.map(p => `
              <div class="ticket-passenger">
                <div>
                  <span style="font-weight: 500;">${p.passenger_name}</span>
                  <span style="color: var(--text-muted); font-size: 0.8rem; margin-left: 8px;">${p.passenger_age}y, ${p.passenger_gender}</span>
                </div>
                <div style="font-size: 0.85rem;">
                  ${p.coach_number ? `${p.coach_number} / Seat ${p.seat_number}` : 'N/A'}
                  ${getStatusBadge(p.status)}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div class="ticket-footer">
        <div>
          <span style="color: var(--text-muted); font-size: 0.8rem;">Total Amount</span>
          <div class="amount" style="font-size: 1.2rem;">${formatCurrency(booking.total_amount)}</div>
        </div>
        <div style="display: flex; gap: 8px;">
          ${booking.status === 'confirmed' ? `
            <button class="btn btn-danger btn-sm" onclick="cancelBooking(${booking.booking_id})">Cancel</button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

async function cancelBooking(bookingId) {
  if (!confirm('Are you sure you want to cancel this booking? A refund will be processed.')) return;

  try {
    const result = await API.put(`/bookings/${bookingId}/cancel`);
    Toast.success(`Booking cancelled. Refund of ${formatCurrency(result.refund_amount)} will be processed.`);
    loadBookings(); // Refresh
  } catch (err) {
    Toast.error(err.error || 'Cancellation failed');
  }
}
