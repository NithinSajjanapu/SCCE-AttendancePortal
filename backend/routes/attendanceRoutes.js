import { Router } from 'express';
import { getAttendance } from '../controllers/attendanceController.js';

const router = Router();

// The attendance endpoint keeps routing separate from validation and SCCE work.
router.post('/', getAttendance);

export default router;
