// Payment Page JS
let paymentData = null;
let selectedMethod = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!Auth.requireAuth()) return;

  paymentData = JSON.parse(sessionStorage.getItem('pending_payment'));
  if (!paymentData) {
    Toast.error('No pending payment found');
    setTimeout(() => window.location.href = '/pages/my-bookings.html', 1500);
    return;
  }

  renderPaymentPage();
});

function renderPaymentPage() {
  const container = document.getElementById('payment-container');
  if (!container) return;

  container.innerHTML = `
    <div class="card" style="margin-bottom: 24px;">
      <h3 style="margin-bottom: 16px;">Booking Summary</h3>
      <div class="payment-summary">
        <div class="payment-row">
          <span>PNR Number</span>
          <span style="font-weight: 600; color: var(--accent);">${paymentData.pnr}</span>
        </div>
        <div class="payment-row">
          <span>Booking ID</span>
          <span>#${paymentData.booking_id}</span>
        </div>
        <div class="payment-row total">
          <span>Total Amount</span>
          <span class="amount">${formatCurrency(paymentData.amount)}</span>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom: 24px;">
      <h3 style="margin-bottom: 16px;">Select Payment Method</h3>
      <div class="payment-methods">
        <div class="payment-method" onclick="selectPaymentMethod(this, 'credit_card')">
          <span class="method-icon">CC</span>
          <div>
            <div class="method-name">Credit Card</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Visa, Mastercard</div>
          </div>
        </div>
        <div class="payment-method" onclick="selectPaymentMethod(this, 'debit_card')">
          <span class="method-icon">DC</span>
          <div>
            <div class="method-name">Debit Card</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">All banks</div>
          </div>
        </div>
        <div class="payment-method" onclick="selectPaymentMethod(this, 'upi')">
          <span class="method-icon">UPI</span>
          <div>
            <div class="method-name">UPI</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">GPay, PhonePe, Paytm</div>
          </div>
        </div>
        <div class="payment-method" onclick="selectPaymentMethod(this, 'net_banking')">
          <span class="method-icon">NB</span>
          <div>
            <div class="method-name">Net Banking</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">All banks</div>
          </div>
        </div>
      </div>

      <div id="payment-form-area"></div>

      <button class="btn btn-accent btn-lg" style="width: 100%; margin-top: 8px;" id="pay-btn" onclick="processPayment()" disabled>
        Pay ${formatCurrency(paymentData.amount)}
      </button>
    </div>
  `;
}

function selectPaymentMethod(el, method) {
  document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
  el.classList.add('selected');
  selectedMethod = method;
  document.getElementById('pay-btn').disabled = false;

  const formArea = document.getElementById('payment-form-area');
  
  if (method === 'upi') {
    formArea.innerHTML = `
      <div class="form-group" style="margin-top: 16px;">
        <label class="form-label">UPI ID</label>
        <input type="text" class="form-input" id="upi-id" placeholder="yourname@upi">
      </div>
    `;
  } else if (method === 'credit_card' || method === 'debit_card') {
    formArea.innerHTML = `
      <div style="margin-top: 16px;">
        <div class="form-group">
          <label class="form-label">Card Number</label>
          <input type="text" class="form-input" id="card-number" placeholder="1234 5678 9012 3456" maxlength="19">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Expiry</label>
            <input type="text" class="form-input" id="card-expiry" placeholder="MM/YY" maxlength="5">
          </div>
          <div class="form-group">
            <label class="form-label">CVV</label>
            <input type="password" class="form-input" id="card-cvv" placeholder="•••" maxlength="3">
          </div>
        </div>
      </div>
    `;
  } else {
    formArea.innerHTML = `
      <div class="form-group" style="margin-top: 16px;">
        <label class="form-label">Select Bank</label>
        <select class="form-select">
          <option>State Bank of India</option>
          <option>HDFC Bank</option>
          <option>ICICI Bank</option>
          <option>Axis Bank</option>
          <option>Punjab National Bank</option>
          <option>Bank of Baroda</option>
        </select>
      </div>
    `;
  }
}

async function processPayment() {
  if (!selectedMethod) {
    Toast.error('Please select a payment method');
    return;
  }

  const btn = document.getElementById('pay-btn');
  btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Processing...';
  btn.disabled = true;

  try {
    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const result = await API.post('/payments', {
      booking_id: paymentData.booking_id,
      payment_mode: selectedMethod
    });

    // Show success
    const container = document.getElementById('payment-container');
    container.innerHTML = `
      <div class="card fade-in" style="text-align: center; padding: 48px;">
        <div style="font-size: 4rem; margin-bottom: 16px; color: var(--success);">&#10003;</div>
        <h2 style="font-family: var(--font-heading); margin-bottom: 8px;">Payment Successful!</h2>
        <p style="color: var(--text-secondary); margin-bottom: 24px;">Your ticket has been booked successfully</p>
        
        <div class="payment-summary" style="text-align: left; margin: 24px 0;">
          <div class="payment-row">
            <span>Transaction ID</span>
            <span style="font-weight: 600;">${result.payment.transaction_id}</span>
          </div>
          <div class="payment-row">
            <span>PNR Number</span>
            <span style="font-weight: 600; color: var(--accent);">${paymentData.pnr}</span>
          </div>
          <div class="payment-row">
            <span>Amount Paid</span>
            <span class="amount">${formatCurrency(result.payment.amount)}</span>
          </div>
          <div class="payment-row">
            <span>Payment Mode</span>
            <span>${result.payment.payment_mode.replace('_', ' ').toUpperCase()}</span>
          </div>
        </div>

        <div style="display: flex; gap: 12px; justify-content: center;">
          <a href="/pages/my-bookings.html" class="btn btn-primary">View My Bookings</a>
          <a href="/pages/search.html" class="btn btn-secondary">Book Another Ticket</a>
        </div>
      </div>
    `;

    sessionStorage.removeItem('pending_payment');
    sessionStorage.removeItem('booking_selection');
    Toast.success('Payment completed successfully!');
  } catch (err) {
    Toast.error(err.error || 'Payment failed');
    btn.innerHTML = `Pay ${formatCurrency(paymentData.amount)}`;
    btn.disabled = false;
  }
}
