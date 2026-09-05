import { AttendanceError } from '../services/collegeAttendanceService.js';
import { getAllDates, getBonafide, getBonafidePdf, getDailyReports, getForgotHallTicket, getProfile, getResults } from '../services/portalSectionsService.js';

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
export const bonafide = createSectionHandler(getBonafide);

export async function bonafidePdf(req, res) {
  const hallTicket = String(req.body?.hallTicket || '').trim().toUpperCase();
  if (!isValidHallTicket(hallTicket)) return res.status(400).json({ success: false, code: 'INVALID_HALL_TICKET', message: 'Please enter a valid Hall Ticket Number.' });
  try {
    const pdf = await getBonafidePdf(hallTicket);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="A27_Bonafide_${hallTicket}.pdf"` });
    return res.send(pdf);
  } catch (error) {
    return res.status(error instanceof AttendanceError ? error.status : 502).json({ success: false, code: error.code || 'PDF_ERROR', message: error.message || 'Unable to create the Bonafide PDF.' });
  }
}

export async function forgotHallTicket(req, res) {
  const name = String(req.body?.name || '').trim();
  if (!/^[A-Za-z ]{4,80}$/.test(name)) return res.status(400).json({ success: false, code: 'INVALID_NAME', message: 'Enter at least four letters from your name.' });
  try {
    return res.json({ success: true, data: await getForgotHallTicket(name) });
  } catch (error) {
    return res.status(error instanceof AttendanceError ? error.status : 502).json({ success: false, code: error.code || 'UPSTREAM_ERROR', message: error.message || 'Unable to find a Hall Ticket Number right now.' });
  }
}
