// Admin Panel JS
let currentSection = 'dashboard';

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth()) return;
  
  const user = Auth.getUser();
  if (!user || user.role !== 'admin') {
    Toast.error('Admin access required');
    setTimeout(() => window.location.href = '/index.html', 1000);
    return;
  }

  showSection('dashboard');
});

function showSection(section) {
  currentSection = section;
  
  // Update sidebar
  document.querySelectorAll('.admin-sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  const content = document.getElementById('admin-content');
  
  switch (section) {
    case 'dashboard': loadDashboard(content); break;
    case 'trains': loadTrains(content); break;
    case 'bookings': loadAdminBookings(content); break;
    case 'add-train': showAddTrainForm(content); break;
    default: loadDashboard(content);
  }
}

async function loadDashboard(container) {
  container.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  try {
    const stats = await API.get('/admin/stats');

    container.innerHTML = `
      <h2 style="font-family: var(--font-heading); font-weight: 800; margin-bottom: 24px;">Dashboard</h2>
      
      <div class="admin-stats">
        <div class="stat-card fade-in">
          <div class="stat-icon"></div>
          <div class="stat-value">${stats.total_users}</div>
          <div class="stat-label">Total Users</div>
        </div>
        <div class="stat-card fade-in">
          <div class="stat-icon"></div>
          <div class="stat-value">${stats.total_trains}</div>
          <div class="stat-label">Total Trains</div>
        </div>
        <div class="stat-card fade-in">
          <div class="stat-icon"></div>
          <div class="stat-value">${stats.total_bookings}</div>
          <div class="stat-label">Total Bookings</div>
        </div>
        <div class="stat-card fade-in">
          <div class="stat-icon"></div>
          <div class="stat-value">${formatCurrency(stats.total_revenue)}</div>
          <div class="stat-label">Total Revenue</div>
        </div>
        <div class="stat-card fade-in">
          <div class="stat-icon"></div>
          <div class="stat-value">${stats.today_bookings}</div>
          <div class="stat-label">Today's Bookings</div>
        </div>
        <div class="stat-card fade-in">
          <div class="stat-icon"></div>
          <div class="stat-value">${stats.cancelled_bookings}</div>
          <div class="stat-label">Cancelled</div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Failed to load dashboard</h3></div>`;
  }
}

async function loadTrains(container) {
  container.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  try {
    const trains = await API.get('/admin/trains');

    container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 24px;">
        <h2 style="font-family: var(--font-heading); font-weight: 800;">Manage Trains</h2>
        <button class="btn btn-primary" onclick="showSection('add-train')">+ Add Train</button>
      </div>

      <div class="card" style="overflow-x: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Train Number</th>
              <th>Name</th>
              <th>Source</th>
              <th>Destination</th>
              <th>Status</th>
              <th>Delay</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${trains.map(t => `
              <tr>
                <td style="font-weight: 600;">${t.train_number}</td>
                <td>${t.train_name}</td>
                <td>${t.source_name}</td>
                <td>${t.dest_name}</td>
                <td>
                  <span style="color: ${t.current_status === 'on_time' ? 'var(--success)' : t.current_status === 'delayed' ? 'var(--warning)' : 'var(--error)'}; font-weight: 600; text-transform: uppercase;">
                    ${(t.current_status || 'active').replace('_', ' ')}
                  </span>
                </td>
                <td>${t.delay_minutes ? t.delay_minutes + ' min' : '—'}</td>
                <td>
                  <button class="btn btn-ghost btn-sm" onclick="showUpdateStatus(${t.train_id}, '${t.train_name}')"> Status</button>
                  <button class="btn btn-danger btn-sm" onclick="deleteTrain(${t.train_id})"></button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Failed to load trains</h3></div>`;
  }
}

async function loadAdminBookings(container) {
  container.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  try {
    const bookings = await API.get('/admin/bookings');

    container.innerHTML = `
      <h2 style="font-family: var(--font-heading); font-weight: 800; margin-bottom: 24px;">All Bookings</h2>

      <div class="card" style="overflow-x: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>PNR</th>
              <th>User</th>
              <th>Train</th>
              <th>Journey Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${bookings.map(b => `
              <tr>
                <td style="font-weight: 600; color: var(--accent);">${b.pnr_number}</td>
                <td>${b.user_name} <br><span style="color:var(--text-muted);font-size:0.8rem;">${b.user_email}</span></td>
                <td>${b.train_name} (#${b.train_number})</td>
                <td>${formatDate(b.journey_date)}</td>
                <td class="amount">${formatCurrency(b.total_amount)}</td>
                <td>${getStatusBadge(b.status)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state"><h3>Failed to load bookings</h3></div>`;
  }
}

async function showAddTrainForm(container) {
  // Load stations
  let stations = [];
  try {
    stations = await API.get('/trains/stations/all');
  } catch (e) {}

  container.innerHTML = `
    <h2 style="font-family: var(--font-heading); font-weight: 800; margin-bottom: 24px;">Add New Train</h2>
    
    <div class="card" style="max-width: 600px;">
      <form id="add-train-form" onsubmit="handleAddTrain(event)">
        <div class="form-group">
          <label class="form-label">Train Name</label>
          <input type="text" class="form-input" id="at-name" required placeholder="e.g. Rajdhani Express">
        </div>
        <div class="form-group">
          <label class="form-label">Train Number</label>
          <input type="text" class="form-input" id="at-number" required placeholder="e.g. 12301">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Source Station</label>
            <select class="form-select" id="at-source" required>
              <option value="">Select source</option>
              ${stations.map(s => `<option value="${s.station_id}">${s.station_name} (${s.station_code})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Destination Station</label>
            <select class="form-select" id="at-dest" required>
              <option value="">Select destination</option>
              ${stations.map(s => `<option value="${s.station_id}">${s.station_name} (${s.station_code})</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Departure Time</label>
            <input type="time" class="form-input" id="at-departure" required>
          </div>
          <div class="form-group">
            <label class="form-label">Arrival Time</label>
            <input type="time" class="form-input" id="at-arrival" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Runs On</label>
          <input type="text" class="form-input" id="at-runs" value="Mon,Tue,Wed,Thu,Fri,Sat,Sun" placeholder="Mon,Tue,Wed...">
        </div>
        <div style="display:flex; gap:12px;">
          <button type="submit" class="btn btn-primary">Add Train</button>
          <button type="button" class="btn btn-ghost" onclick="showSection('trains')">Cancel</button>
        </div>
      </form>
    </div>
  `;
}

async function handleAddTrain(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Adding...';
  btn.disabled = true;

  try {
    await API.post('/admin/trains', {
      train_name: document.getElementById('at-name').value,
      train_number: document.getElementById('at-number').value,
      source_station_id: parseInt(document.getElementById('at-source').value),
      destination_station_id: parseInt(document.getElementById('at-dest').value),
      departure_time: document.getElementById('at-departure').value,
      arrival_time: document.getElementById('at-arrival').value,
      runs_on: document.getElementById('at-runs').value
    });

    Toast.success('Train added successfully!');
    showSection('trains');
  } catch (err) {
    Toast.error(err.error || 'Failed to add train');
    btn.innerHTML = 'Add Train';
    btn.disabled = false;
  }
}

function showUpdateStatus(trainId, trainName) {
  const modal = document.getElementById('status-modal');
  if (!modal) {
    // Create modal
    const div = document.createElement('div');
    div.id = 'status-modal';
    div.className = 'modal-overlay';
    div.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 id="status-modal-title">Update Train Status</h2>
          <button class="modal-close" onclick="document.getElementById('status-modal').classList.remove('show')">✕</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">Current Station</label>
            <input type="text" class="form-input" id="us-station" placeholder="Station name">
          </div>
          <div class="form-group">
            <label class="form-label">Delay (minutes)</label>
            <input type="number" class="form-input" id="us-delay" value="0" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="us-status">
              <option value="on_time">On Time</option>
              <option value="delayed">Delayed</option>
              <option value="cancelled">Cancelled</option>
              <option value="arrived">Arrived</option>
              <option value="departed">Departed</option>
            </select>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="document.getElementById('status-modal').classList.remove('show')">Cancel</button>
          <button class="btn btn-primary" id="us-submit-btn">Update Status</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  document.getElementById('status-modal-title').textContent = `Update: ${trainName}`;
  document.getElementById('us-submit-btn').onclick = async () => {
    try {
      await API.put(`/admin/trains/${trainId}/status`, {
        current_station: document.getElementById('us-station').value,
        delay_minutes: parseInt(document.getElementById('us-delay').value) || 0,
        status: document.getElementById('us-status').value
      });
      Toast.success('Status updated! Users notified.');
      document.getElementById('status-modal').classList.remove('show');
      showSection('trains');
    } catch (err) {
      Toast.error(err.error || 'Update failed');
    }
  };

  document.getElementById('status-modal').classList.add('show');
}

async function deleteTrain(trainId) {
  if (!confirm('Are you sure you want to delete this train? This cannot be undone.')) return;

  try {
    await API.delete(`/admin/trains/${trainId}`);
    Toast.success('Train deleted');
    showSection('trains');
  } catch (err) {
    Toast.error(err.error || 'Delete failed');
  }
}
