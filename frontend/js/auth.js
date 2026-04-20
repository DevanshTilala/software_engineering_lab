// Auth page JS — Login & Register
document.addEventListener('DOMContentLoaded', () => {
  // If already logged in, redirect
  if (Auth.isLoggedIn()) {
    window.location.href = '/index.html';
    return;
  }

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
});

async function handleLogin(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Logging in...';
  btn.disabled = true;

  try {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const data = await API.post('/auth/login', { email, password });
    Auth.setAuth(data.token, data.user);
    Toast.success('Login successful! Welcome back.');

    setTimeout(() => {
      if (data.user.role === 'admin') {
        window.location.href = '/pages/admin.html';
      } else {
        window.location.href = '/index.html';
      }
    }, 500);
  } catch (err) {
    Toast.error(err.error || 'Login failed. Please check your credentials.');
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Creating account...';
  btn.disabled = true;

  try {
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const phone = document.getElementById('phone').value;
    const password = document.getElementById('password').value;
    const confirmPassword = document.getElementById('confirm-password').value;

    if (password !== confirmPassword) {
      throw { error: 'Passwords do not match' };
    }

    if (password.length < 6) {
      throw { error: 'Password must be at least 6 characters' };
    }

    const data = await API.post('/auth/register', { name, email, phone, password });
    Auth.setAuth(data.token, data.user);
    Toast.success('Account created successfully! Welcome aboard.');

    setTimeout(() => {
      window.location.href = '/index.html';
    }, 500);
  } catch (err) {
    const msg = err.errors ? err.errors.map(e => e.msg).join(', ') : (err.error || 'Registration failed');
    Toast.error(msg);
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}
