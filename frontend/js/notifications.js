// Notifications Page JS
document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth()) return;
  loadNotifications();
});

async function loadNotifications() {
  const container = document.getElementById('notifications-container');
  if (!container) return;

  container.innerHTML = '<div class="loader"><div class="spinner"></div></div>';

  try {
    const data = await API.get('/notifications');
    const notifications = data.notifications;

    if (notifications.length === 0) {
      container.innerHTML = `
        <div class="empty-state fade-in">
          <div class="empty-icon"></div>
          <h3>No notifications</h3>
          <p>You're all caught up!</p>
        </div>
      `;
      return;
    }

    const header = document.getElementById('notif-header-actions');
    if (header && data.unread_count > 0) {
      header.innerHTML = `
        <span style="color: var(--text-muted); font-size: 0.9rem;">${data.unread_count} unread</span>
        <button class="btn btn-ghost btn-sm" onclick="markAllRead()">Mark all as read</button>
      `;
    }

    container.innerHTML = notifications.map(n => renderNotification(n)).join('');
  } catch (err) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"></div>
        <h3>Failed to load notifications</h3>
        <p>${err.error || ''}</p>
      </div>
    `;
  }
}

function renderNotification(n) {
  const icons = {
    booking: '',
    cancellation: '',
    delay: '',
    payment: '',
    general: ''
  };

  const timeAgo = getTimeAgo(new Date(n.created_at));

  return `
    <div class="notification-item ${n.is_read ? '' : 'unread'}" onclick="markRead(${n.notification_id}, this)">
      <div class="notification-icon ${n.type}">
        ${icons[n.type] || ''}
      </div>
      <div class="notification-content">
        <div class="notification-message">${n.message}</div>
        <div class="notification-time">${timeAgo}</div>
      </div>
    </div>
  `;
}

async function markRead(id, el) {
  try {
    await API.put(`/notifications/${id}/read`);
    el.classList.remove('unread');
  } catch (err) {
    // silent
  }
}

async function markAllRead() {
  try {
    await API.put('/notifications/read-all');
    Toast.success('All notifications marked as read');
    loadNotifications();
  } catch (err) {
    Toast.error('Failed to mark notifications');
  }
}

function getTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(date);
}
