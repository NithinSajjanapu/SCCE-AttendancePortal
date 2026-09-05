import { Router } from 'express';
import { allDates, bonafide, bonafidePdf, dailyReports, forgotHallTicket, profile, results } from '../controllers/portalSectionsController.js';

const router = Router();

// These routes are mounted at /api in server.js, preserving the public paths.
router.post('/profile', profile);
router.post('/daily-reports', dailyReports);
router.post('/all-dates', allDates);
router.post('/results', results);
router.post('/forgot-hall-ticket', forgotHallTicket);
router.post('/bonafide', bonafide);
router.post('/bonafide/pdf', bonafidePdf);

export default router;
