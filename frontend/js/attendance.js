// -----------------------------------------------------------------------------
// Page state and DOM references
// -----------------------------------------------------------------------------

const state = {
  hallTicket: sessionStorage.getItem('attendance-ticket')
};

const content = document.querySelector('#dashboard-content');
const loadingPanel = document.querySelector('#loading-panel');
const errorPanel = document.querySelector('#error-panel');
const refreshButton = document.querySelector('#refresh-button');
let activeSection = 'attendance';

// -----------------------------------------------------------------------------
// Display utilities
// -----------------------------------------------------------------------------

/** Converts values such as "75%" and "75" into a safe number for rendering. */
function toNumber(value) {
  const number = Number(String(value ?? '').replace('%', '').trim());
  return Number.isFinite(number) ? number : 0;
}

function calculatePercentage(attended, conducted) {
  return conducted > 0 ? Math.round((attended / conducted) * 100) : 0;
}

// These classes drive the existing five-level attendance colour system.
function statusFor(percentage) {
  if (percentage <= 35) return ['critical', 'Critical'];
  if (percentage < 55) return ['low', 'Low'];
  if (percentage < 65) return ['warning', 'Improve'];
  if (percentage < 75) return ['caution', 'Watch'];
  return ['good', 'Good'];
}

// Portal values are external data, so escape them before inserting HTML strings.
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

/** Use the first letters of the first two name parts for a recognisable avatar. */
function initialsFromName(name) {
  return String(name || 'Student')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'S';
}

/**
 * Normalise the API response once at the boundary. This keeps display code
 * simple and handles percentage strings returned by older portal markup.
 */
function normaliseAttendance(data) {
  const subjects = (Array.isArray(data.subjects) ? data.subjects : []).map((subject) => {
    const attended = toNumber(subject.attended);
    const conducted = toNumber(subject.conducted);

    return {
      name: String(subject.name || 'Unnamed subject'),
      attended,
      conducted,
      percentage: conducted
        ? calculatePercentage(attended, conducted)
        : toNumber(subject.percentage)
    };
  });

  // Subject totals are used so the overview always matches the subject list.
  const attended = subjects.reduce((total, subject) => total + subject.attended, 0);
  const conducted = subjects.reduce((total, subject) => total + subject.conducted, 0);

  return {
    student: {
      hallTicket: data.student?.hallTicket || state.hallTicket || '—',
      name: data.student?.name || 'Student',
      year: data.student?.year || 'Year not provided'
    },
    subjects,
    overall: {
      attended,
      conducted,
      percentage: calculatePercentage(attended, conducted)
    }
  };
}

function setLoading(isLoading) {
  loadingPanel.hidden = !isLoading;
  content.hidden = isLoading;
  errorPanel.hidden = true;
  refreshButton.disabled = isLoading;
}

function subjectRow(subject, index) {
  return `
    <article class="subject-card reveal" style="--delay:${index * 45}ms">
      <div class="subject-name">
        <h3>${escapeHtml(subject.name)}</h3>
        <span>${subject.attended} / ${subject.conducted} classes</span>
      </div>
      <strong class="subject-percent">${subject.percentage}%</strong>
    </article>
  `;
}

// -----------------------------------------------------------------------------
// Attendance rendering and animation
// -----------------------------------------------------------------------------

function render(data) {
  const { student, subjects, overall } = normaliseAttendance(data);
  const [statusClass, statusLabel] = statusFor(overall.percentage);
  const lowSubjects = subjects.filter((subject) => subject.percentage < 75);

  content.innerHTML = `
    <section class="dash-title reveal">
      <div>
        <p class="eyebrow">STUDENT DASHBOARD</p>
        <h1>Attendance overview</h1>
        <p class="college-name">Sree Chaitanya College of Engineering</p>
      </div>
      <span class="status-pill ${statusClass}"><i></i>${statusLabel} attendance</span>
    </section>

    <section class="student-card reveal">
      <div class="student-avatar" aria-hidden="true">${escapeHtml(initialsFromName(student.name))}</div>
      <div>
        <span>STUDENT</span>
        <h2 class="student-name">${escapeHtml(student.name)}</h2>
        <p>${escapeHtml(student.hallTicket)} · ${escapeHtml(student.year)}</p>
      </div>
    </section>

    <section class="overview-grid">
      <article class="overall-card reveal">
        <div>
          <p>OVERALL ATTENDANCE</p>
          <h2>${overall.attended} <span>/ ${overall.conducted} classes</span></h2>
          <p class="overall-caption">Attend consistently to stay on track.</p>
        </div>
        <div
          class="progress-circle ${statusClass}"
          style="--progress:0"
          data-progress="${overall.percentage}"
          aria-label="Overall attendance: ${overall.percentage}%"
        >
          <div class="progress-circle-label">
            <strong data-count="${overall.percentage}">0</strong><small>%</small>
          </div>
        </div>
      </article>

      <article class="stats-card reveal"><span>◫</span><p>Total subjects</p><strong>${subjects.length}</strong></article>
      <article class="stats-card reveal"><span>✓</span><p>Classes attended</p><strong>${overall.attended}</strong></article>
      <article class="stats-card reveal"><span>◷</span><p>Classes conducted</p><strong>${overall.conducted}</strong></article>
    </section>

    <section class="section-heading reveal">
      <div>
        <p class="eyebrow">SUBJECT BREAKDOWN</p>
        <h2>Subject attendance</h2>
      </div>
      <span>${lowSubjects.length} below 75%</span>
    </section>

    <section class="subject-list reveal">${subjects.map(subjectRow).join('')}</section>
  `;

  // A successful response must always hide the loader and any earlier error panel.
  loadingPanel.hidden = true;
  errorPanel.hidden = true;
  content.hidden = false;
  refreshButton.disabled = false;
  animateDashboard();
}

function animateDashboard() {
  requestAnimationFrame(() => {
    document.querySelectorAll('.reveal').forEach((element) => {
      element.classList.add('visible');
    });

    document.querySelectorAll('.bar i').forEach((element) => {
      element.classList.add('animate');
    });

    // Fill the circular ring and count the number at exactly the same speed.
    document.querySelectorAll('.progress-circle').forEach((circle) => {
      const target = toNumber(circle.dataset.progress);
      const startedAt = performance.now();

      const updateRing = (now) => {
        const progress = Math.min(1, (now - startedAt) / 850);
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        circle.style.setProperty('--progress', String(target * easedProgress));

        if (progress < 1) requestAnimationFrame(updateRing);
      };

      requestAnimationFrame(updateRing);
    });

    document.querySelectorAll('[data-count]').forEach((element) => {
      const target = toNumber(element.dataset.count);
      const startedAt = performance.now();

      const update = (now) => {
        const progress = Math.min(1, (now - startedAt) / 850);
        element.textContent = Math.round(target * (1 - Math.pow(1 - progress, 3)));

        if (progress < 1) requestAnimationFrame(update);
      };

      requestAnimationFrame(update);
    });
  });
}

async function loadAttendance(forceRefresh = false) {
  const cached = sessionStorage.getItem('attendance-result');

  if (!forceRefresh && cached) {
    try {
      render(JSON.parse(cached));
      return;
    } catch {
      sessionStorage.removeItem('attendance-result');
    }
  }

  if (!state.hallTicket) {
    location.href = 'index.html';
    return;
  }

  setLoading(true);

  try {
    const data = await window.attendanceApi(state.hallTicket);
    sessionStorage.setItem('attendance-result', JSON.stringify(data));
    render(data);
  } catch (error) {
    loadingPanel.hidden = true;
    content.hidden = true;
    errorPanel.hidden = false;
    refreshButton.disabled = false;
    document.querySelector('#error-message').textContent = error.message;
  }
}

// -----------------------------------------------------------------------------
// Additional portal sections
// -----------------------------------------------------------------------------

function renderSectionError(message) {
  content.innerHTML = `
    <section class="empty-state">
      <h2>Unable to load this information</h2>
      <p>${escapeHtml(message)}</p>
      <button class="refresh-button" id="section-retry">Try Again</button>
    </section>
  `;
  content.hidden = false;

  document.querySelector('#section-retry').addEventListener('click', () => {
    loadSection(activeSection);
  });
}

function renderPortalSection(section, data) {
  if (section === 'profile') {
    const fields = Object.entries(data.fields || {});
    const studentName = data.fields?.['Student Name'] || 'Student';

    content.innerHTML = `
      <section class="section-heading">
        <div><p class="eyebrow">STUDENT PROFILE</p><h2>Your profile</h2></div>
      </section>
      <section class="profile-hero">
        <div class="profile-photo-ring">
          ${data.photoUrl
            ? `<img src="${escapeHtml(data.photoUrl)}" alt="${escapeHtml(studentName)}">`
            : `<div class="student-avatar">${escapeHtml(initialsFromName(studentName))}</div>`}
        </div>
        <strong>${escapeHtml(studentName)}</strong>
      </section>
      <section class="profile-list">
        ${fields.map(([label, value]) => `
          <div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>
        `).join('') || '<p class="empty-state">No profile information available.</p>'}
      </section>
    `;
  } else if (section === 'all-dates') {
    const records = data.records || [];
    const range = createDateRange(records);
    const days = records.reduce((groups, row) => {
      (groups[row.date] ||= []).push(row);
      return groups;
    }, {});

    content.innerHTML = `
      <section class="section-heading">
        <div>
          <p class="eyebrow">ATTENDANCE HISTORY</p>
          <h2>All dates</h2>
          ${range ? `<p class="date-range">${range.start} – ${range.end} <span>•</span> Total ${range.days} Days</p>` : ''}
        </div>
      </section>
      <section class="all-dates-list">
        ${Object.entries(days).map(([date, rows]) => `
          <section class="report-day">
            <p>${escapeHtml(date)}</p>
            ${rows.map((row) => `
              <div>
                <strong>${escapeHtml(row.subject)}</strong>
                <span class="attendance-status ${row.attended ? 'present' : 'absent'}">
                  ${row.attended ? 'Present' : 'Absent'}
                </span>
                <b>${row.attended}/${row.conducted}</b>
              </div>
            `).join('')}
          </section>
        `).join('') || '<p class="empty-state">No records available.</p>'}
      </section>
    `;
  } else if (section === 'daily-reports') {
    const options = (data.availableDates || [])
      .map((date) => `<option value="${escapeHtml(date.value)}">${escapeHtml(date.label)}</option>`)
      .join('');
    const records = (data.records || [])
      .map((row) => `
        <div>
          <strong>${escapeHtml(row.subject)}${row.hour ? ` · Hour ${escapeHtml(row.hour)}` : ''}</strong>
          <span>${row.attended ? 'Present' : 'Absent'} · ${row.attended}/${row.conducted}</span>
        </div>
      `)
      .join('');

    content.innerHTML = `
      <section class="section-heading">
        <div><p class="eyebrow">DAILY ATTENDANCE</p><h2>Daily report</h2></div>
      </section>
      <label class="date-picker">
        Choose date
        <select id="daily-date"><option value="">Select a date</option>${options}</select>
      </label>
      <section class="report-list">
        ${records || '<p class="empty-state">Choose a date to view its report.</p>'}
      </section>
    `;
    document.querySelector('#daily-date').value = data.selectedDate || '';
    document.querySelector('#daily-date').addEventListener('change', (event) => {
      loadSection('daily-reports', event.target.value);
    });
  } else if (section === 'results') {
    const semesters = (data.records || []).reduce((groups, record) => {
      const key = `Year ${record.year} · Semester ${record.semester}`;
      (groups[key] ||= []).push(record);
      return groups;
    }, {});

    content.innerHTML = `
      <section class="section-heading">
        <div><p class="eyebrow">ACADEMIC RESULTS</p><h2>Academic results</h2></div>
      </section>
      <section class="results-list">
        ${Object.entries(semesters).map(([semester, records]) => `
          <section class="semester-group">
            <h3>${escapeHtml(semester)}</h3>
            ${records.map((record) => {
              // SCCE's established result rule: only EM >= 21 is a pass.
              const externalMarks = Number(record.externalMarks);
              const passed = Number.isFinite(externalMarks) && externalMarks >= 21;

              return `
                <div>
                  <div>
                    <strong>${escapeHtml(record.subject)}</strong>
                    <span>EM ${Number.isFinite(externalMarks) ? externalMarks : '—'} · ${record.totalMarks} / ${record.maximumMarks} marks · ${record.credits} credits</span>
                  </div>
                  <b class="result-status ${passed ? 'passed' : 'failed'}">${passed ? 'PASS' : 'FAIL'}</b>
                </div>
              `;
            }).join('')}
          </section>
        `).join('') || '<p class="empty-state">No results available.</p>'}
      </section>
    `;
  }

  content.hidden = false;
}

/** Build the All Dates summary from SCCE's earliest record and the browser's current day. */
function createDateRange(records) {
  if (!records.length || !/^\d{2}-\d{2}-\d{4}$/.test(records[0].date)) {
    return null;
  }

  const [day, month, year] = records[0].date.split('-').map(Number);
  const start = new Date(year, month - 1, day);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);

  const days = Math.max(1, Math.floor((today - start) / 86400000) + 1);
  const label = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

  return { start: label.format(start), end: label.format(today), days };
}

async function loadSection(section, date = '') {
  activeSection = section;
  document.querySelectorAll('[data-section]').forEach((button) => {
    button.classList.toggle('active', button.dataset.section === section);
  });

  if (section === 'attendance') {
    return loadAttendance();
  }

  loadingPanel.hidden = false;
  content.hidden = true;
  errorPanel.hidden = true;

  try {
    const data = await window.portalApi(section, {
      hallTicket: state.hallTicket,
      date
    });
    renderPortalSection(section, data);
  } catch (error) {
    loadingPanel.hidden = true;
    renderSectionError(error.message);
  } finally {
    loadingPanel.hidden = true;
  }
}

// -----------------------------------------------------------------------------
// Event handlers and initial page load
// -----------------------------------------------------------------------------

refreshButton.addEventListener('click', () => loadAttendance(true));

document.querySelectorAll('[data-section]').forEach((button) => {
  button.addEventListener('click', () => loadSection(button.dataset.section));
});

document.querySelector('#retry-button').addEventListener('click', () => {
  loadAttendance(true);
});

document.querySelector('#back-button').addEventListener('click', () => {
  location.href = 'index.html';
});

loadAttendance();
