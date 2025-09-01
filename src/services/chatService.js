// src/services/chatService.js
const { db } = require('../config/firebase');
const { generateUuid } = require('../utils/uuid');

const groupChatsRef = db.ref('group_chats');
const messagesRef = db.ref('messages');

const createChatGroup = async (name, description, type, createdByUserID) => {
    const groupID = generateUuid();
    const newGroup = {
        name,
        description: description || '',
        type: type || 'public',
        createdByUserID,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        members: {
            [createdByUserID]: {
                joinedAt: new Date().toISOString(),
                role: 'admin'
            }
        }
    };

    await groupChatsRef.child(groupID).set(newGroup);
    return { groupID, ...newGroup };
};

const getAllChatGroups = async () => {
    const snapshot = await groupChatsRef.once('value');
    const groups = [];
    snapshot.forEach(childSnapshot => {
        groups.push({
            groupID: childSnapshot.key,
            ...childSnapshot.val()
        });
    });
    return groups;
};

const getChatGroup = async (groupID) => {
    const snapshot = await groupChatsRef.child(groupID).once('value');
    return snapshot.val() ? { groupID: snapshot.key, ...snapshot.val() } : null;
};

const getMessagesInGroup = async (groupID, limit = 50) => {
    const snapshot = await messagesRef.child(groupID).orderByChild('timestamp').limitToLast(limit).once('value');
    const messages = [];
    snapshot.forEach(childSnapshot => {
        messages.push({
            id: childSnapshot.key,
            ...childSnapshot.val()
        });
    });
    return messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

const getMessageById = async (groupID, messageID) => {
    const snapshot = await messagesRef.child(groupID).child(messageID).once('value');
    return snapshot.val() ? { id: snapshot.key, ...snapshot.val() } : null;
};

module.exports = {
    createChatGroup,
    getAllChatGroups,
    getChatGroup,
    getMessagesInGroup,
    getMessageById,
};
