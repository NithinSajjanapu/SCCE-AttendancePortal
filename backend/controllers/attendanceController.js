import { lookupAttendance, AttendanceError } from '../services/collegeAttendanceService.js';

const HALL_TICKET_PATTERN = /^[A-Z0-9][A-Z0-9-]{5,24}$/;

export async function getAttendance(req, res) {
  const hallTicket = String(req.body?.hallTicket || '')
    .trim()
    .toUpperCase();

  if (!HALL_TICKET_PATTERN.test(hallTicket)) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_HALL_TICKET',
      message: 'Please enter a valid Hall Ticket Number.'
    });
  }

  try {
    // The controller owns the HTTP response; the service owns SCCE communication.
    const attendance = await lookupAttendance(hallTicket);
    return res.json({ success: true, ...attendance });
  } catch (error) {
    const status = error instanceof AttendanceError ? error.status : 502;
    const code = error instanceof AttendanceError ? error.code : 'UPSTREAM_ERROR';
    const message = error instanceof AttendanceError
      ? error.message
      : 'Attendance portal is temporarily unavailable. Please try again later.';

    return res.status(status).json({ success: false, code, message });
  }
}
