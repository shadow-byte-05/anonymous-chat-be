// src/controllers/userController.js
const userService = require('../services/userService');

const setupUser = async (req, res, next) => {
    const { username, avatar } = req.body;

    if (!username) {
        return res.status(400).json({ success: false, message: 'Username is required.' });
    }

    try {
        const newUser = await userService.createUser(username, avatar);
        res.status(201).json({
            success: true,
            message: 'User created successfully.',
            data: {
                userID: newUser.userID,
                username: newUser.username,
                avatar: newUser.avatar
            }
        });
    } catch (error) {
        next(error); // Pass error to error handling middleware
    }
};

const getUserProfile = async (req, res, next) => {
    const { userID } = req.params;

    try {
        const user = await userService.getUserById(userID);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        next(error);
    }
};

const getLeaderboard = async (req, res, next) => {
    try {
        const leaderboard = await userService.getLeaderboard();
        res.status(200).json({ success: true, data: leaderboard });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    setupUser,
    getUserProfile,
    getLeaderboard,
};