import * as cheerio from 'cheerio';
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer';
import { AttendanceError } from './collegeAttendanceService.js';

const BASE_URL = 'https://scce.ac.in/parentm/';
const clean = (value) => String(value || '').replace(/\s+/g, ' ').trim();
const number = (value) => Number(clean(value).match(/\d+/)?.[0] || 0);
const PUBLIC_BASE_URL = 'https://scce.ac.in/parent12/';
const RESULTS_URL = 'https://scce.ac.in/result/index.php';
const timeoutMs = Number(process.env.COLLEGE_REQUEST_TIMEOUT_MS || 12000);
let bonafideBrowserPromise;

async function getBonafideBrowser() {
  if (!bonafideBrowserPromise) {
    bonafideBrowserPromise = (async () => {
      // executablePath() is the exact browser revision managed by this
      // Puppeteer installation (or the explicitly configured executable).
      // Check it before launch so a cache/deployment problem is clear in logs
      // without exposing a server filesystem path to API clients.
      if (!existsSync(puppeteer.executablePath())) {
        throw new AttendanceError(
          'BONAFIDE_BROWSER_UNAVAILABLE',
          'The Bonafide PDF service is temporarily unavailable. Please try again later.',
          503
        );
      }

      const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
      browser.once('disconnected', () => {
        bonafideBrowserPromise = undefined;
        console.warn('BONAFIDE_BROWSER_DISCONNECTED');
      });
      console.log('BONAFIDE_BROWSER_READY');
      return browser;
    })();

    try {
      await bonafideBrowserPromise;
    } catch (error) {
      bonafideBrowserPromise = undefined;
      console.error('BONAFIDE_BROWSER_INIT_FAILED', error.code || error.name);
      throw error;
    }
  }
  return bonafideBrowserPromise;
}

function warmBonafideBrowser() {
  // Warm only after SCCE has returned a real certificate. This avoids an
  // unnecessary browser launch (and a misleading startup failure) for users
  // who never use the Bonafide feature.
  void getBonafideBrowser().catch((error) => {
    console.error('BONAFIDE_BROWSER_WARMUP_FAILED', error.code || error.name);
  });
}

async function publicPost(url, fields) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(fields), signal: controller.signal });
    const html = await response.text();
    if (!response.ok || !html.trim()) throw new AttendanceError('PORTAL_UNAVAILABLE', 'The college portal is temporarily unavailable. Please try again later.');
    return html;
  } catch (error) {
    if (error instanceof AttendanceError) throw error;
    if (error.name === 'AbortError') throw new AttendanceError('TIMEOUT', 'The college portal took too long to respond.', 504);
    throw new AttendanceError('PORTAL_UNAVAILABLE', 'The college portal is temporarily unavailable. Please try again later.');
  } finally { clearTimeout(timer); }
}

function tableRows($, table) {
  return $(table).find('tr').toArray().map((row) => $(row).find('td,th').toArray().map((cell) => clean($(cell).text())));
}

export async function getForgotHallTicket(name) {
  const html = await publicPost(`${PUBLIC_BASE_URL}forgothtno.php`, { name, dayatten: 'Search' });
  const $ = cheerio.load(html);
  const table = $('table').filter((_i, item) => /Hallticket\s*No/i.test(clean($(item).text()))).last();
  const rows = tableRows($, table).filter((row) => row.length >= 2 && !/^sl\s*no/i.test(row[0]));
  const matches = rows.filter((row) => /[A-Z0-9]{6,}/i.test(row[1] || '')).map((row) => ({ hallTicket: row[1], name: row[2] || '', fatherName: row[3] || '', branch: row[4] || '', year: row[5] || '' }));
  if (!matches.length) throw new AttendanceError('NOT_FOUND', 'No Hall Ticket Number was found for those letters.', 404);
  return { matches };
}

function parseResultsHtml(html, hallTicket) {
  const $ = cheerio.load(html);
  const info = {};
  $('table').each((_i, table) => tableRows($, table).forEach((row) => {
    if (row.length >= 2 && /^(Hall Ticket|Name|Father Name)\s*:/i.test(row[0])) info[row[0].replace(/\s*:\s*$/, '')] = row[1];
  }));
  const subjectTable = $('table').filter((_i, table) => /Subject\s*Code[\s\S]*Internal\s*Marks/i.test(clean($(table).text()))).first();
  const rows = tableRows($, subjectTable);
  const headers = (rows[0] || []).map((header) => header.replace(/\s+/g, '').toLowerCase());
  const index = (name) => headers.indexOf(name);
  const records = rows.slice(1).filter((row) => /^\d+$/.test(row[0] || '')).map((row) => ({
    subjectCode: row[index('subjectcode')] || '', subject: row[index('subjectname')] || '', subjectCredits: row[index('subjectcredits')] || '', grade: row[index('grade')] || '', gradePoint: row[index('gradepoint')] || '', totalGradePoint: row[index('subjectc*studentgp')] || '', internalMarks: row[index('internalmarks')] || '', externalMarks: row[index('externalmarks')] || '', totalMarks: row[index('totalmarks')] || '', maximumMarks: row[index('maxmarks')] || '', credits: row[index('credits')] || '', year: row[index('year')] || '', semester: row[index('sem')] || '', date: row[index('date')] || ''
  }));
  if (!records.length) throw new AttendanceError('NOT_FOUND', 'No results were found for this Hall Ticket Number.', 404);
  const text = clean($.root().text());
  const metric = (label) => text.match(new RegExp(`${label}\\s*:?\\s*([\\d.]+)`, 'i'))?.[1] || '';
  const backlogTable = $('table').filter((_i, table) => /BACKLOG SUBJECT/i.test(clean($(table).text()))).first();
  const backlogRows = tableRows($, backlogTable).filter((row) => /^\d+$/.test(row[0] || '')).map((row) => ({ subjectCode: row[1] || '', subject: row[2] || '', grade: row[3] || '', gradePoint: row[4] || '', totalGradePoint: row[5] || '', year: row[6] || '', semester: row[7] || '', date: row[8] || '' }));
  return { summary: { name: info.Name || '', hallTicket: info['Hall Ticket'] || hallTicket, cgpa: metric('CGPA'), percentage: metric('Percentage\\s*%'), credits: metric('Total Registered Subject Credits') }, records, backlogs: backlogRows };
}

export async function getResults(hallTicket) {
  return parseResultsHtml(await publicPost(RESULTS_URL, { htno: hallTicket, resultstu: 'Results' }), hallTicket);
}

async function getBonafideHtml(hallTicket) {
  const html = await publicPost(`${PUBLIC_BASE_URL}bc/bc.php`, { HallticketNo: hallTicket, submit: 'Login' });
  if (/certificate disabled|contact\s+ao/i.test(html)) throw new AttendanceError('CERTIFICATE_UNAVAILABLE', 'A Bonafide certificate is not available for this Hall Ticket Number.', 404);
  if (!/BONAFIDE CERTIFICATE/i.test(html)) throw new AttendanceError('UNREADABLE_RESPONSE', 'Unable to read the Bonafide certificate right now.');
  const $ = cheerio.load(html);
  $('script, noscript').remove();
  $('*').each((_i, element) => {
    Object.keys(element.attribs || {}).filter((name) => /^on/i.test(name)).forEach((name) => $(element).removeAttr(name));
  });
  $('img[src]').each((_i, image) => $(image).attr('src', new URL($(image).attr('src'), `${PUBLIC_BASE_URL}bc/`).toString()));
  $('head').append(`<style id="a27-certificate-layout">
    /* Render the portal's certificate on one predictable A4 canvas.  The
       portal uses a fixed-width table inside another table; both must share
       the printable width or the inner content is cut off. */
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body { width: 210mm; min-height: 297mm; margin: 0; overflow: hidden; background: #fff; }
    body { padding: 10mm; }
    center { display: block; width: 100%; }
    center > table,
    center > table > tbody > tr > td > table {
      width: 100% !important;
      max-width: 100% !important;
      height: auto !important;
    }
    img { max-width: 100% !important; height: auto !important; }
    .style12 { font-size: 16px !important; line-height: 1.65 !important; }
  </style>`);
  return $.html();
}

export async function getBonafide(hallTicket) {
  const html = await getBonafideHtml(hallTicket);
  warmBonafideBrowser();
  return { html };
}

export async function getBonafidePdf(hallTicket) {
  const html = await getBonafideHtml(hallTicket);
  let page;
  try {
    const browser = await getBonafideBrowser();
    page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const url = request.url();
      const isCertificateResource = url.startsWith(`${PUBLIC_BASE_URL}bc/`);
      if (url === 'about:blank' || url.startsWith('data:') || isCertificateResource) {
        void request.continue();
      } else {
        void request.abort('blockedbyclient');
      }
    });
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load', timeout: timeoutMs });
    await page.emulateMediaType('print');
    return Buffer.from(await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }));
  } catch (error) {
    if (error instanceof AttendanceError) throw error;
    console.error('BONAFIDE_PDF_FAILED', error.name);
    if (error.name === 'TimeoutError') throw new AttendanceError('TIMEOUT', 'The Bonafide certificate took too long to render.', 504);
    throw new AttendanceError('PDF_ERROR', 'Unable to create the Bonafide PDF right now.');
  } finally {
    await page?.close().catch(() => {});
  }
}

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
