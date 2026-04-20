// Train Status Page JS
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('status-form');
  if (form) {
    form.addEventListener('submit', handleStatusSearch);
  }
});

async function handleStatusSearch(e) {
  e.preventDefault();
  const query = document.getElementById('status-query').value.trim();
  
  if (!query) {
    Toast.error('Please enter a train number or PNR');
    return;
  }

  const container = document.getElementById('status-container');
  container.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  try {
    // Try to find train by number — search all trains
    let trainId = null;

    // If it looks like a PNR (10 digits), search bookings
    if (/^\d{10}$/.test(query)) {
      // PNR lookup - get user's bookings and find matching PNR
      if (Auth.isLoggedIn()) {
        const bookings = await API.get('/bookings');
        const booking = bookings.find(b => b.pnr_number === query);
        if (booking) {
          trainId = booking.train_id;
        }
      }
      if (!trainId) {
        container.innerHTML = `
          <div class="empty-state fade-in">
            <div class="empty-icon">?</div>
            <h3>PNR not found</h3>
            <p>Please check the PNR number and try again</p>
          </div>
        `;
        return;
      }
    } else {
      // Train number lookup
      trainId = parseInt(query);
      
      // If not a number, search by train number string
      if (isNaN(trainId)) {
        container.innerHTML = `
          <div class="empty-state fade-in">
            <div class="empty-icon">?</div>
            <h3>Please enter a valid train number</h3>
            <p>Example: 12301 (Rajdhani Express)</p>
          </div>
        `;
        return;
      }
    }

    const data = await API.get(`/trains/${trainId}/status`);
    renderTrainStatus(data);
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state fade-in">
        <div class="empty-icon">!</div>
        <h3>Train status not available</h3>
        <p>${err.error || 'Please check the train number and try again'}</p>
      </div>
    `;
  }
}

function renderTrainStatus(data) {
  const { status, stops } = data;
  const container = document.getElementById('status-container');

  const statusColors = {
    'on_time': 'var(--success)',
    'delayed': 'var(--warning)',
    'cancelled': 'var(--error)',
    'arrived': 'var(--info)',
    'departed': 'var(--primary)'
  };

  container.innerHTML = `
    <div class="card fade-in" style="margin-bottom: 24px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h2 style="font-family: var(--font-heading); font-weight: 800;">${status.train_name}</h2>
          <span style="color: var(--text-muted);">#${status.train_number}</span>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.85rem; color: var(--text-muted);">Current Status</div>
          <div style="font-weight: 700; color: ${statusColors[status.status] || 'var(--text-primary)'}; text-transform: uppercase; font-size: 1.1rem;">
            ${status.status.replace('_', ' ')}
          </div>
          ${status.delay_minutes > 0 ? `<div style="color: var(--error); font-size: 0.85rem;">Delayed by ${status.delay_minutes} minutes</div>` : ''}
        </div>
      </div>
      ${status.current_station ? `
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
          <span style="color: var(--text-muted);">Current Station:</span>
          <span style="font-weight: 600; margin-left: 8px;">${status.current_station}</span>
        </div>
      ` : ''}
    </div>

    <div class="card fade-in">
      <h3 style="margin-bottom: 24px; font-family: var(--font-heading);">Route Timeline</h3>
      <div class="status-timeline">
        ${stops.map((stop, idx) => {
          let stopClass = '';
          // Simple logic: passed stations are before current, current is the current_station match
          if (status.current_station && stop.station_name.includes(status.current_station.split(' ')[0])) {
            stopClass = 'current';
          } else if (idx < stops.findIndex(s => s.station_name.includes((status.current_station || '').split(' ')[0]))) {
            stopClass = 'passed';
          }

          return `
            <div class="status-stop ${stopClass}">
              <div class="stop-name">${stop.station_name} (${stop.station_code})</div>
              <div class="stop-time">
                ${stop.arrival_time ? `Arr: ${formatTime(stop.arrival_time)}` : ''}
                ${stop.arrival_time && stop.departure_time ? ' | ' : ''}
                ${stop.departure_time ? `Dep: ${formatTime(stop.departure_time)}` : ''}
              </div>
              ${status.delay_minutes > 0 && stopClass !== 'passed' ? `<div class="stop-delay">Expected delay: ${status.delay_minutes} min</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}
