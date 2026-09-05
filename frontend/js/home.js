const form = document.querySelector('#attendance-form');
const input = document.querySelector('#hall-ticket');
const submitButton = document.querySelector('#submit-button');
const errorNode = document.querySelector('#form-error');
const validTicket = (value) => /^[A-Z0-9][A-Z0-9-]{5,24}$/.test(value);
const forgotButton = document.querySelector('#forgot-ticket-button');
const forgotForm = document.querySelector('#forgot-ticket-form');
const forgotName = document.querySelector('#forgot-name');
const forgotError = document.querySelector('#forgot-error');
const forgotResults = document.querySelector('#forgot-results');

function updateInput() {
  input.value = input.value.trim().toUpperCase();
  submitButton.disabled = !validTicket(input.value);
  errorNode.textContent = '';
}

input.addEventListener('input', updateInput);

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  updateInput();

  if (!validTicket(input.value)) {
    errorNode.textContent = 'Please enter a valid Hall Ticket Number.';
    input.focus();
    return;
  }

  submitButton.disabled = true;
  submitButton.classList.add('is-loading');

  try {
    // Fetch once before navigation so the dashboard can render immediately from
    // session storage, while Refresh can still request the latest live value.
    const result = await window.attendanceApi(input.value);
    sessionStorage.setItem('attendance-result', JSON.stringify(result));
    sessionStorage.setItem('attendance-ticket', input.value);
    location.href = 'attendance.html';
  } catch (error) {
    errorNode.textContent = error.message;
    submitButton.classList.remove('is-loading');
    submitButton.disabled = false;
  }
});

forgotButton.addEventListener('click', () => { forgotForm.hidden = !forgotForm.hidden; if (!forgotForm.hidden) forgotName.focus(); });
document.querySelector('#forgot-search-button').addEventListener('click', async () => {
  const name = forgotName.value.trim();
  forgotError.textContent = ''; forgotResults.innerHTML = '';
  if (!/^[A-Za-z ]{4,80}$/.test(name)) { forgotError.textContent = 'Enter at least four letters from your name.'; return; }
  try {
    const data = await window.portalApi('forgot-hall-ticket', { name });
    forgotResults.innerHTML = data.matches.map((match) => `<button type="button" class="forgot-match" data-ticket="${match.hallTicket}"><strong>${match.hallTicket}</strong><span>${match.name}${match.branch ? ` · ${match.branch}` : ''}</span></button>`).join('');
    forgotResults.querySelectorAll('[data-ticket]').forEach((button) => button.addEventListener('click', () => { input.value = button.dataset.ticket; updateInput(); forgotForm.hidden = true; input.focus(); }));
  } catch (error) { forgotError.textContent = error.message; }
});
