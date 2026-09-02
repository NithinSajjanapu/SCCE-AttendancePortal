import * as cheerio from 'cheerio';
import { AttendanceError } from './collegeAttendanceService.js';

const BASE_URL = 'https://scce.ac.in/parentm/';
const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const number = (value) => Number(clean(value).match(/\d+/)?.[0] || 0);

/**
 * Establish a public SCCE PHP session once, authenticate it with the supplied
 * Hall Ticket number, then give callers a request helper bound to that cookie.
 * Cookies never leave the server or appear in the browser response.
 */
async function withStudentSession(hallTicket, task) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const start = await fetch(BASE_URL, {
      redirect: 'manual',
      signal: controller.signal
    });
    const cookie = start.headers.get('set-cookie')?.split(';')[0];

    if (!cookie) {
      throw new AttendanceError(
        'PORTAL_UNAVAILABLE',
        'Attendance portal is temporarily unavailable.'
      );
    }

    const login = await fetch(`${BASE_URL}index.php`, {
      method: 'POST',
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        cookie
      },
      body: new URLSearchParams({
        HallticketNo: hallTicket,
        submit: 'Login'
      })
    });
    const location = login.headers.get('location');

    if (!location) {
      throw new AttendanceError('NOT_FOUND', 'No student record found.', 404);
    }

    // Visit the redirect once so the session is in the same state as SCCE's UI.
    await fetch(new URL(location, `${BASE_URL}index.php`), {
      signal: controller.signal,
      headers: {
        cookie,
        referer: BASE_URL
      }
    });

    const request = async (path, options = {}) => {
      // Spread custom options first, then merge headers so a POST cannot drop
      // the session cookie that SCCE requires for every protected report page.
      const response = await fetch(`${BASE_URL}${path}`, {
        signal: controller.signal,
        ...options,
        headers: {
          cookie,
          referer: BASE_URL,
          ...(options.headers || {})
        }
      });

      return { response, html: await response.text() };
    };

    return await task(request);
  } catch (error) {
    if (error instanceof AttendanceError) throw error;

    if (error.name === 'AbortError') {
      throw new AttendanceError(
        'TIMEOUT',
        'The attendance portal took too long to respond.',
        504
      );
    }

    throw new AttendanceError(
      'PORTAL_UNAVAILABLE',
      'Attendance portal is temporarily unavailable. Please try again later.'
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Read the real profile table and select the non-logo image when SCCE provides one. */
export async function getProfile(hallTicket) {
  return withStudentSession(hallTicket, async (request) => {
    const { response, html } = await request('info.php');

    if (!response.ok) {
      throw new AttendanceError('PORTAL_UNAVAILABLE', 'Unable to load profile right now.');
    }

    const $ = cheerio.load(html);
    const fields = {};

    $('tr').each((_index, row) => {
      const cells = $(row).find('th,td');
      if (cells.length < 2) return;

      const label = clean(cells.eq(0).text()).replace(/:$/, '');
      const value = clean(cells.eq(1).text()).replace(/^:/, '');

      if (label && value) {
        fields[label] = value;
      }
    });

    // The first site image is often the college logo, not the student photo.
    const photoSource = $('img[src]')
      .map((_index, image) => $(image).attr('src'))
      .get()
      .find((source) => source && !/logo/i.test(source));

    return {
      fields,
      photoUrl: photoSource ? new URL(photoSource, BASE_URL).toString() : null
    };
  });
}

/** Parse SCCE's all-dates rows and always present them from oldest to newest. */
function parseHistory(html) {
  const $ = cheerio.load(html);
  const records = [];

  $('tr').each((_index, row) => {
    const cells = $(row)
      .find('td')
      .map((_cellIndex, cell) => clean($(cell).text()))
      .get();

    if (cells.length >= 5 && /^\d+$/.test(cells[0])) {
      records.push({
        date: cells[1],
        subject: cells[2],
        attended: number(cells[3]),
        conducted: number(cells[4])
      });
    }
  });

  return records.sort((first, second) => {
    const parseDate = (value) => {
      const [day, month, year] = value.split('-').map(Number);
      return new Date(year, month - 1, day).getTime();
    };

    return parseDate(first.date) - parseDate(second.date);
  });
}

/** Parse both daily table variants currently returned by SCCE. */
function parseDailyReport(html, selectedDate) {
  const $ = cheerio.load(html);
  const records = [];

  $('tr').each((_index, row) => {
    const cells = $(row)
      .find('td')
      .map((_cellIndex, cell) => clean($(cell).text()))
      .get();

    // Standard format: Sno / Hour / Sub / Atnd / Cnctd.
    if (cells.length >= 5 && /^\d+$/.test(cells[0]) && /^\d+$/.test(cells[1])) {
      records.push({
        date: selectedDate,
        hour: cells[1],
        subject: cells[2],
        attended: number(cells[3]),
        conducted: number(cells[4])
      });
      return;
    }

    // Compatibility format: Sno / Sub / Atnd / Cnctd.
    if (cells.length >= 4 && /^\d+$/.test(cells[0])) {
      records.push({
        date: selectedDate,
        hour: null,
        subject: cells[1],
        attended: number(cells[2]),
        conducted: number(cells[3])
      });
    }
  });

  return records;
}

export async function getAllDates(hallTicket) {
  return withStudentSession(hallTicket, async (request) => {
    const { response, html } = await request('Dailywise1.php');

    if (!response.ok) {
      throw new AttendanceError(
        'PORTAL_UNAVAILABLE',
        'Unable to load attendance history right now.'
      );
    }

    return { records: parseHistory(html) };
  });
}

export async function getDailyReports(hallTicket, selectedDate = '') {
  return withStudentSession(hallTicket, async (request) => {
    let result = await request('Dailywisereport.php');
    const $ = cheerio.load(result.html);
    const availableDates = $('select[name="date"] option')
      .map((_index, option) => ({
        value: $(option).attr('value') || clean($(option).text()),
        label: clean($(option).text())
      }))
      .get()
      .filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item.value));

    if (!selectedDate) {
      return { availableDates, selectedDate: '', records: [] };
    }

    // The portal expects a POST plus its `dayatten` submit value for a date.
    result = await request('Dailywisereport.php', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        date: selectedDate,
        dayatten: 'Submit'
      })
    });

    return {
      availableDates,
      selectedDate,
      records: parseDailyReport(result.html, selectedDate)
    };
  });
}

export async function getResults(hallTicket) {
  return withStudentSession(hallTicket, async (request) => {
    const { response, html } = await request('ac_results.php');
    const $ = cheerio.load(html);
    const records = [];

    // SCCE may send HTTP 500 alongside a genuine result table. Read the real
    // rows first, then only treat the status as a failure when no rows exist.
    $('tr').each((_index, row) => {
      const cells = $(row)
        .find('td')
        .map((_cellIndex, cell) => clean($(cell).text()))
        .get();

      // Table columns: Sn / Sub / IM / EM / TM / MM / Cr / Yr / Sm.
      if (cells.length >= 9 && /^\d+$/.test(cells[0])) {
        records.push({
          subject: cells[1],
          internalMarks: number(cells[2]),
          externalMarks: number(cells[3]),
          totalMarks: number(cells[4]),
          maximumMarks: number(cells[5]),
          credits: number(cells[6]),
          year: cells[7],
          semester: cells[8]
        });
      }
    });

    if (records.length) {
      return { records };
    }

    if (!response.ok || /fatal error|internal server error/i.test(html)) {
      throw new AttendanceError(
        'RESULTS_PORTAL_UNAVAILABLE',
        'Academic results are not available from the college portal right now.',
        502
      );
    }

    return { records };
  });
}
