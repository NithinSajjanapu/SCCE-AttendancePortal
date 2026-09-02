// Keep deployment-specific values in one small file. For local development the
// frontend and Express server share localhost:5000; a deployed static frontend
// can replace this with its deployed API origin without changing application code.
window.APP_CONFIG = {
  API_BASE_URL: 'https://scce-attendanceportal.onrender.com'
};
