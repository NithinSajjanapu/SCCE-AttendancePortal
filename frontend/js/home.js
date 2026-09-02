const form = document.querySelector('#attendance-form');
const input = document.querySelector('#hall-ticket');
const submitButton = document.querySelector('#submit-button');
const errorNode = document.querySelector('#form-error');
const validTicket = (value) => /^[A-Z0-9][A-Z0-9-]{5,24}$/.test(value);

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
