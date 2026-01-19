const express = require('express');
const router = express.Router();
const vaccineController = require('../controllers/vaccineController');

// /api/vaccines/schedule/:userId 형태로 요청
router.get('/schedule/:userId', vaccineController.getVaccineSchedule);

module.exports = router;