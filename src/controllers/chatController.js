// src/controllers/chatController.js
const chatService = require('../services/chatService');

const createChatGroup = async (req, res, next) => {
    const { name, description, type, createdByUserID } = req.body;

    if (!name || !createdByUserID) {
        return res.status(400).json({ success: false, message: 'Group name and creator ID are required.' });
    }

    try {
        const newGroup = await chatService.createChatGroup(name, description, type, createdByUserID);
        res.status(201).json({
            success: true,
            message: 'Group chat created successfully.',
            data: newGroup
        });
    } catch (error) {
        next(error);
    }
};

const getAllChatGroups = async (req, res, next) => {
    try {
        const groups = await chatService.getAllChatGroups();
        res.status(200).json({ success: true, data: groups });
    } catch (error) {
        next(error);
    }
};

const getChatGroupDetails = async (req, res, next) => {
    const { groupID } = req.params;

    try {
        const group = await chatService.getChatGroup(groupID);
        if (!group) {
            return res.status(404).json({ success: false, message: 'Group chat not found.' });
        }
        res.status(200).json({ success: true, data: group });
    } catch (error) {
        next(error);
    }
};

const getGroupMessages = async (req, res, next) => {
    const { groupID } = req.params;
    const { limit } = req.query; // Optional: ?limit=20

    try {
        const messages = await chatService.getMessagesInGroup(groupID, parseInt(limit) || 50);
        res.status(200).json({ success: true, data: messages });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createChatGroup,
    getAllChatGroups,
    getChatGroupDetails,
    getGroupMessages,
};