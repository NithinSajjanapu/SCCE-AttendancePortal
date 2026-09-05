(() => {
  // Persist the selected theme so the interface feels consistent between pages.
  const storedTheme = localStorage.getItem('attendance-theme');
  const systemTheme = matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

  document.documentElement.dataset.theme = storedTheme || systemTheme;

  document.querySelectorAll('.theme-toggle').forEach((button) => {
    button.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('attendance-theme', theme);
    });
  });
})();

// The browser talks only to our Express API. College requests, cookies, and
// HTML parsing stay on the server so they are not exposed to students.
window.attendanceApi = async (hallTicket) => {
  const base = window.APP_CONFIG?.API_BASE_URL || '';
  const response = await fetch(`${base}/api/attendance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hallTicket })
  });
  const result = await response.json().catch(() => ({
    success: false,
    message: 'Unable to read attendance data right now.'
  }));

  if (!response.ok || !result.success) {
    throw Object.assign(
      new Error(result.message || 'Something went wrong. Please try again.'),
      { code: result.code }
    );
  }

  return result;
};

// Additional portal views use the same controlled server-to-server pattern.
window.portalApi = async (endpoint, body) => {
  const base = window.APP_CONFIG?.API_BASE_URL || '';
  const response = await fetch(`${base}/api/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const result = await response.json().catch(() => ({
    success: false,
    message: 'Unable to read this information right now.'
  }));

  if (!response.ok || !result.success) {
    throw Object.assign(
      new Error(result.message || 'Unable to load this information right now.'),
      { code: result.code }
    );
  }

  return result.data;
};

window.downloadBonafidePdf = async (hallTicket) => {
  const base = window.APP_CONFIG?.API_BASE_URL || '';
  const response = await fetch(`${base}/api/bonafide/pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hallTicket }) });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || 'Unable to create the Bonafide PDF.');
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url; link.download = `A27_Bonafide_${hallTicket}.pdf`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
