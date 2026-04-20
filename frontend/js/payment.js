// Payment Page JS
let paymentData = null;

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

    <div class="card">
      <h3 style="margin-bottom: 16px;">Confirm Payment</h3>
      <p style="color: var(--text-secondary); margin-bottom: 24px;">
        Click the button below to complete your payment and confirm your ticket.
      </p>
      <button class="btn btn-accent btn-lg" style="width: 100%;" id="pay-btn" onclick="processPayment()">
        Pay ${formatCurrency(paymentData.amount)}
      </button>
    </div>
  `;
}

async function processPayment() {
  const btn = document.getElementById('pay-btn');
  btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Processing...';
  btn.disabled = true;

  try {
    // Simulate short processing delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    const result = await API.post('/payments', {
      booking_id: paymentData.booking_id,
      payment_mode: 'upi'
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
