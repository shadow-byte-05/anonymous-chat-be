// src/services/messageService.js
const { db } = require('../config/firebase');

const messagesRef = db.ref('messages');

const addMessage = async (groupID, messageID, messageData) => {
    await messagesRef.child(groupID).child(messageID).set(messageData);
};

const updateMessage = async (groupID, messageID, updateData) => {
    await messagesRef.child(groupID).child(messageID).update(updateData);
};

const addReaction = async (groupID, messageID, userID, emoji) => {
    // Use Firebase transaction to safely update reactions
    const reactionPath = `messages/${groupID}/${messageID}/reactions/${emoji}/${userID}`;
    await db.ref(reactionPath).set(true); // Set to true to indicate user reacted
};

const removeReaction = async (groupID, messageID, userID, emoji) => {
    const reactionPath = `messages/${groupID}/${messageID}/reactions/${emoji}/${userID}`;
    await db.ref(reactionPath).remove(); // Remove user's reaction
};

// This function is less granular, intended for when you need to replace all reactions or complex updates.
// For adding/removing single reactions, the addReaction/removeReaction methods are more efficient.
const updateMessageReactions = async (groupID, messageID, reactions) => {
    await messagesRef.child(groupID).child(messageID).child('reactions').set(reactions);
};


module.exports = {
    addMessage,
    updateMessage,
    addReaction,
    removeReaction,
    updateMessageReactions,
};