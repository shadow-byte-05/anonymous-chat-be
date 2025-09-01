// src/services/userService.js
const { db } = require('../config/firebase');
const { generateUuid } = require('../utils/uuid');
const { DEFAULT_AVATARS, GAMIFICATION_POINTS } = require('../utils/constants');

const usersRef = db.ref('users');

const createUser = async (username, avatar) => {
    // Check for username uniqueness
    const snapshot = await usersRef.orderByChild('username').equalTo(username).once('value');
    if (snapshot.exists()) {
        const error = new Error('Username already taken.');
        error.statusCode = 409; // Conflict
        throw error;
    }

    const userID = generateUuid();
    const newUser = {
        username,
        avatar: avatar || DEFAULT_AVATARS[Math.floor(Math.random() * DEFAULT_AVATARS.length)],
        points: 0,
        createdAt: new Date().toISOString(),
    };

    await usersRef.child(userID).set(newUser);
    return { userID, ...newUser };
};

const getUserById = async (userID) => {
    const snapshot = await usersRef.child(userID).once('value');
    return snapshot.val() ? { id: snapshot.key, ...snapshot.val() } : null;
};

const getUserByUsername = async (username) => {
    const snapshot = await usersRef.orderByChild('username').equalTo(username).once('value');
    const userData = snapshot.val();
    if (userData) {
        const userID = Object.keys(userData)[0];
        return { id: userID, ...userData[userID] };
    }
    return null;
};

const incrementUserPoints = async (userID, pointsToAdd) => {
    try {
        const userRef = usersRef.child(userID);
        await userRef.child('points').transaction((currentPoints) => {
            return (currentPoints || 0) + pointsToAdd;
        });
        console.log(`User ${userID} gained ${pointsToAdd} points.`);
        return true;
    } catch (error) {
        console.error(`Failed to increment points for user ${userID}:`, error);
        return false;
    }
};

const getLeaderboard = async (limit = 10) => {
    const snapshot = await usersRef.orderByChild('points').limitToLast(limit).once('value');
    const leaderboard = [];
    snapshot.forEach(childSnapshot => {
        const user = childSnapshot.val();
        leaderboard.push({
            userID: childSnapshot.key,
            username: user.username,
            points: user.points
        });
    });
    // Sort descending by points (Firebase's limitToLast gives ascending by key for equal values)
    return leaderboard.sort((a, b) => b.points - a.points);
};

module.exports = {
    createUser,
    getUserById,
    getUserByUsername,
    incrementUserPoints,
    getLeaderboard,
};