// Train Search & Schedule JS
document.addEventListener('DOMContentLoaded', () => {
  const searchForm = document.getElementById('train-search-form');
  if (searchForm) {
    searchForm.addEventListener('submit', handleSearch);
    loadStations();
  }

  // Check if we have search params from URL
  const params = new URLSearchParams(window.location.search);
  if (params.get('from') && params.get('to')) {
    document.getElementById('from-station').value = params.get('from');
    document.getElementById('to-station').value = params.get('to');
    if (params.get('date')) {
      document.getElementById('journey-date').value = params.get('date');
    }
    handleSearch(null);
  }

  // Set minimum date to today
  const dateInput = document.getElementById('journey-date');
  if (dateInput) {
    dateInput.min = new Date().toISOString().split('T')[0];
    if (!dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
  }
});

async function loadStations() {
  try {
    const stations = await API.get('/trains/stations/all');
    const fromSelect = document.getElementById('from-station');
    const toSelect = document.getElementById('to-station');
    const fromList = document.getElementById('from-suggestions');
    const toList = document.getElementById('to-suggestions');

    if (fromList && toList) {
      stations.forEach(s => {
        const opt1 = document.createElement('option');
        opt1.value = `${s.station_name} (${s.station_code})`;
        fromList.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = `${s.station_name} (${s.station_code})`;
        toList.appendChild(opt2);
      });
    }
  } catch (err) {
    console.error('Failed to load stations:', err);
  }
}

function swapStations() {
  const from = document.getElementById('from-station');
  const to = document.getElementById('to-station');
  if (from && to) {
    const temp = from.value;
    from.value = to.value;
    to.value = temp;
  }
}

async function handleSearch(e) {
  if (e) e.preventDefault();

  const from = document.getElementById('from-station').value;
  const to = document.getElementById('to-station').value;
  const date = document.getElementById('journey-date').value;

  if (!from || !to) {
    Toast.error('Please enter source and destination stations');
    return;
  }

  const resultsDiv = document.getElementById('search-results');
  resultsDiv.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  try {
    const trains = await API.get(`/trains/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${date}`);

    if (trains.length === 0) {
      resultsDiv.innerHTML = `
        <div class="empty-state fade-in">
          <div class="empty-icon"></div>
          <h3>No trains found</h3>
          <p>Try different stations or dates</p>
        </div>
      `;
      return;
    }

    resultsDiv.innerHTML = `
      <p style="color: var(--text-secondary); margin-bottom: 16px;">Found <strong>${trains.length}</strong> train(s) from <strong>${from}</strong> to <strong>${to}</strong></p>
      ${trains.map(train => renderTrainCard(train, date)).join('')}
    `;
  } catch (err) {
    resultsDiv.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"></div>
        <h3>Search failed</h3>
        <p>${err.error || 'Please try again later'}</p>
      </div>
    `;
  }
}

function renderTrainCard(train, date) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const runsOn = (train.runs_on || '').split(',');

  return `
    <div class="train-card fade-in">
      <div class="train-card-header">
        <div class="train-info">
          <h3>${train.train_name}</h3>
          <span class="train-number">#${train.train_number}</span>
        </div>
        <div class="train-runs">
          ${days.map(d => `<span class="day ${runsOn.includes(d) ? 'active' : ''}">${d[0]}</span>`).join('')}
        </div>
      </div>
      
      <div class="train-route">
        <div class="train-station">
          <div class="time">${formatTime(train.board_time || train.departure_time)}</div>
          <div class="name">${train.source_name} (${train.source_code})</div>
        </div>
        <div class="train-duration">
          <div class="duration-text">${train.distance_km ? train.distance_km + ' km' : '--'}</div>
          <div class="duration-line"></div>
          <div class="stops-text" onclick="viewSchedule(${train.train_id})">View Schedule →</div>
        </div>
        <div class="train-station dest">
          <div class="time">${formatTime(train.alight_time || train.arrival_time)}</div>
          <div class="name">${train.dest_name} (${train.dest_code})</div>
        </div>
      </div>

      <div class="train-classes">
        ${(train.coaches || []).map(c => `
          <div class="class-chip" onclick="selectClass(${train.train_id}, '${c.coach_type}', ${c.fare}, '${date}', ${train.source_station_id || 'null'}, ${train.destination_station_id || 'null'})">
            <span class="class-name">${c.coach_type}</span>
            <span class="class-avail ${c.available_seats <= 0 ? 'none' : c.available_seats <= 10 ? 'low' : ''}">${c.available_seats > 0 ? `${c.available_seats} avl` : 'WL'}</span>
            <span class="class-fare">${formatCurrency(c.fare)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function selectClass(trainId, coachType, fare, date, srcStation, destStation) {
  if (!Auth.isLoggedIn()) {
    Toast.info('Please login to book tickets');
    setTimeout(() => window.location.href = '/pages/login.html', 1000);
    return;
  }
  // Store selection and redirect to seat selection
  sessionStorage.setItem('booking_selection', JSON.stringify({
    train_id: trainId,
    coach_type: coachType,
    fare: fare,
    journey_date: date,
    source_station_id: srcStation,
    destination_station_id: destStation
  }));
  window.location.href = '/pages/seat-selection.html';
}

function viewSchedule(trainId) {
  window.location.href = `/pages/train-schedule.html?id=${trainId}`;
}
