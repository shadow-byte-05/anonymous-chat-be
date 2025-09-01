// src/routes/userRoutes.js
const express = require('express');
const { setupUser, getUserProfile, getLeaderboard } = require('../controllers/userController');

const router = express.Router();

router.post('/setup', setupUser);
router.get('/:userID', getUserProfile);
router.get('/leaderboard', getLeaderboard); // Note: this path should be specific, otherwise it might conflict with '/:userID'

module.exports = router;