import { AttendanceError } from '../services/collegeAttendanceService.js';
import { getAllDates, getDailyReports, getProfile, getResults } from '../services/portalSectionsService.js';

const isValidHallTicket = (value) => /^[A-Z0-9][A-Z0-9-]{5,24}$/.test(
  String(value || '').trim().toUpperCase()
);

// Each portal section follows the same validation and error contract. The
// individual service determines which SCCE page to request and how to parse it.
const createSectionHandler = (service) => async (req, res) => {
  const hallTicket = String(req.body?.hallTicket || '')
    .trim()
    .toUpperCase();

  if (!isValidHallTicket(hallTicket)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_HALL_TICKET',
      message: 'Please enter a valid Hall Ticket Number.'
    });
  }

  try {
    const data = await service(hallTicket, req.body?.date);
    return res.json({ success: true, data });
  } catch (error) {
    const status = error instanceof AttendanceError ? error.status : 502;
    const code = error.code || 'UPSTREAM_ERROR';
    const message = error.message || 'Unable to load this information right now.';

    return res.status(status).json({ success: false, code, message });
  }
};

export const profile = createSectionHandler(getProfile);
export const allDates = createSectionHandler(getAllDates);
export const dailyReports = createSectionHandler(getDailyReports);
export const results = createSectionHandler(getResults);
