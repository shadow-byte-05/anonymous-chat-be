// src/routes/chatRoutes.js
const express = require('express');
const { createChatGroup, getAllChatGroups, getChatGroupDetails, getGroupMessages } = require('../controllers/chatController');

const router = express.Router();

router.post('/', createChatGroup);
router.get('/', getAllChatGroups);
router.get('/:groupID', getChatGroupDetails);
router.get('/:groupID/messages', getGroupMessages);

module.exports = router;