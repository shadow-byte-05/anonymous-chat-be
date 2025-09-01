// src/utils/websocket.js
const WebSocket = require('ws');
const { db } = require('../config/firebase');
const { generateUuid } = require('./uuid');
const { GAMIFICATION_POINTS, TYPING_INDICATOR_TIMEOUT_MS } = require('./constants');
const { getUserById, incrementUserPoints } = require('../services/userService');
const { getChatGroup, getMessageById } = require('../services/chatService');
const { addMessage, addReaction, removeReaction, updateMessageReactions } = require('../services/messageService');

// Map to store connected clients by userID
const clients = new Map(); // userID -> WebSocket instance
// Map to store group subscriptions: groupID -> Set<userID>
const groupSubscriptions = new Map();
// Map to store typing indicator timeouts: groupID -> userID -> timeoutId
const typingTimeouts = new Map();

// --- Helper Functions for Broadcasting ---
const broadcastToGroup = (groupID, data, excludeUserID = null) => {
    const subscribers = groupSubscriptions.get(groupID);
    if (subscribers) {
        subscribers.forEach(userID => {
            if (userID !== excludeUserID) {
                const ws = clients.get(userID);
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify(data));
                }
            }
        });
    }
};

const broadcastToAll = (data) => {
    clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    });
};

// --- Typing Indicator Logic ---
const clearTypingStatus = (groupID, userID) => {
    const groupTypingRef = db.ref(`typing_indicators/${groupID}/${userID}`);
    groupTypingRef.remove()
        .then(() => {
            // Inform clients that user stopped typing
            broadcastToGroup(groupID, {
                type: 'user_typing',
                payload: {
                    groupID,
                    userID,
                    username: (clients.get(userID) || {})._username || 'Unknown', // Retrieve username from WS instance
                    isTyping: false
                }
            });
        })
        .catch(error => console.error(`Error clearing typing status for ${userID} in ${groupID}:`, error));
    
    // Clear the timeout from our local map
    const groupTimeouts = typingTimeouts.get(groupID);
    if (groupTimeouts) {
        groupTimeouts.delete(userID);
        if (groupTimeouts.size === 0) {
            typingTimeouts.delete(groupID);
        }
    }
};

const handleTyping = async (ws, { groupID, userID, isTyping }) => {
    if (!groupID || !userID) return;

    const user = await getUserById(userID);
    if (!user) return; // User not found

    const groupTypingRef = db.ref(`typing_indicators/${groupID}/${userID}`);
    
    // Manage local timeouts
    if (!typingTimeouts.has(groupID)) {
        typingTimeouts.set(groupID, new Map());
    }
    const groupUserTimeouts = typingTimeouts.get(groupID);

    if (isTyping) {
        // Update Firebase with last typing timestamp
        await groupTypingRef.set({
            username: user.username,
            timestamp: new Date().toISOString()
        });

        // Clear any existing timeout for this user in this group
        if (groupUserTimeouts.has(userID)) {
            clearTimeout(groupUserTimeouts.get(userID));
        }

        // Set a new timeout to clear typing status
        const timeoutId = setTimeout(() => clearTypingStatus(groupID, userID), TYPING_INDICATOR_TIMEOUT_MS);
        groupUserTimeouts.set(userID, timeoutId);

        // Broadcast typing status (only if it's a new 'typing' event or if state changed)
        broadcastToGroup(groupID, {
            type: 'user_typing',
            payload: {
                groupID,
                userID,
                username: user.username,
                isTyping: true
            }
        }, userID); // Exclude sender
    } else {
        // User explicitly stopped typing
        clearTimeout(groupUserTimeouts.get(userID)); // Clear any pending timeout
        clearTypingStatus(groupID, userID);
    }
};


// --- Main WebSocket Initialization ---
const initializeWebSocket = (server) => {
    const wss = new WebSocket.Server({ server });

    wss.on('connection', (ws) => {
        console.log('Client connected to WebSocket.');

        ws.on('message', async (message) => {
            try {
                const parsedMessage = JSON.parse(message.toString());
                const { type, payload } = parsedMessage;

                switch (type) {
                    case 'register_user_ws': {
                        // This event links a WebSocket connection to a userID
                        const { userID, username } = payload;
                        if (userID && username) {
                            if (clients.has(userID)) {
                                console.log(`User ${userID} already connected, closing old connection.`);
                                clients.get(userID).close();
                            }
                            clients.set(userID, ws);
                            ws._userID = userID; // Store userID on ws instance
                            ws._username = username; // Store username on ws instance
                            console.log(`User ${username} (${userID}) registered via WebSocket.`);
                        } else {
                            ws.send(JSON.stringify({ type: 'error', payload: 'userID and username are required for registration.' }));
                        }
                        break;
                    }
                    case 'join_chat': {
                        const { groupID, userID } = payload;
                        if (groupID && userID) {
                            if (!groupSubscriptions.has(groupID)) {
                                groupSubscriptions.set(groupID, new Set());
                            }
                            groupSubscriptions.get(groupID).add(userID);
                            console.log(`User ${userID} joined group ${groupID}`);

                            // Also attach Firebase listener for new messages in this group
                            const messagesRef = db.ref(`messages/${groupID}`);
                            const messageListener = messagesRef.limitToLast(1).on('child_added', (snapshot) => {
                                const newMessage = { id: snapshot.key, ...snapshot.val() };
                                console.log(`Firebase: New message in ${groupID}:`, newMessage.id);
                                broadcastToGroup(groupID, {
                                    type: 'new_message',
                                    payload: { groupID, message: newMessage }
                                });
                            });
                            // Store listener reference to remove it later on disconnect
                            if (!ws._firebaseListeners) ws._firebaseListeners = {};
                            ws._firebaseListeners[`messages/${groupID}`] = messageListener;

                            // Attach Firebase listener for message updates (reactions)
                            const reactionsRef = db.ref(`messages/${groupID}`);
                            const reactionListener = reactionsRef.on('child_changed', (snapshot) => {
                                const updatedMessage = { id: snapshot.key, ...snapshot.val() };
                                console.log(`Firebase: Message updated in ${groupID}:`, updatedMessage.id);
                                broadcastToGroup(groupID, {
                                    type: 'message_updated',
                                    payload: { groupID, message: updatedMessage } // Send the whole updated message for simplicity
                                });
                            });
                            ws._firebaseListeners[`reactions/${groupID}`] = reactionListener;

                             // Attach Firebase listener for typing indicators
                             const typingRef = db.ref(`typing_indicators/${groupID}`);
                             const typingListener = typingRef.on('value', (snapshot) => {
                                 const typingUsers = snapshot.val() || {};
                                 const activeTypers = Object.entries(typingUsers)
                                     .filter(([, data]) => {
                                         // Filter out users whose typing status timed out or is outdated
                                         const lastTyped = new Date(data.timestamp).getTime();
                                         return (Date.now() - lastTyped) < TYPING_INDICATOR_TIMEOUT_MS;
                                     })
                                     .map(([userID, data]) => ({
                                         userID,
                                         username: data.username,
                                         isTyping: true
                                     }));
 
                                 broadcastToGroup(groupID, {
                                     type: 'group_typing_status',
                                     payload: { groupID, activeTypers }
                                 });
                             });
                             ws._firebaseListeners[`typing_indicators/${groupID}`] = typingListener;

                        } else {
                            ws.send(JSON.stringify({ type: 'error', payload: 'groupID and userID are required to join chat.' }));
                        }
                        break;
                    }
                    case 'send_message': {
                        const { groupID, senderID, encryptedContent, replyToMessageID } = payload;
                        if (!groupID || !senderID || !encryptedContent) {
                            ws.send(JSON.stringify({ type: 'error', payload: 'Missing message fields.' }));
                            return;
                        }

                        // Get sender details for denormalization
                        const sender = await getUserById(senderID);
                        if (!sender) {
                            ws.send(JSON.stringify({ type: 'error', payload: 'Sender not found.' }));
                            return;
                        }

                        const messageID = generateUuid();
                        const newMessage = {
                            id: messageID, // Store ID directly in the object for easy client access
                            senderID,
                            senderUsername: sender.username,
                            senderAvatar: sender.avatar,
                            encryptedContent,
                            timestamp: new Date().toISOString(),
                            reactions: {} // Initialize empty reactions
                        };
                        if (replyToMessageID) {
                            newMessage.replyToMessageID = replyToMessageID;
                        }

                        await addMessage(groupID, messageID, newMessage);
                        console.log(`Message ${messageID} sent to ${groupID} by ${senderID}`);

                        // Gamification: +1 point for sending a message
                        await incrementUserPoints(senderID, GAMIFICATION_POINTS.MESSAGE_SENT);

                        // Gamification: +2 points for reply received
                        if (replyToMessageID) {
                            const originalMessage = await getMessageById(groupID, replyToMessageID);
                            if (originalMessage && originalMessage.senderID !== senderID) { // Don't give points for replying to self
                                await incrementUserPoints(originalMessage.senderID, GAMIFICATION_POINTS.REPLY_RECEIVED);
                            }
                        }

                        // Clear typing status after sending a message
                        clearTimeout((typingTimeouts.get(groupID) || {}).get(senderID));
                        clearTypingStatus(groupID, senderID);

                        // Message will be broadcast via Firebase listener triggered by addMessage
                        break;
                    }
                    case 'add_reaction': {
                        const { groupID, messageID, userID, emoji } = payload;
                        if (!groupID || !messageID || !userID || !emoji) {
                            ws.send(JSON.stringify({ type: 'error', payload: 'Missing reaction fields.' }));
                            return;
                        }

                        await addReaction(groupID, messageID, userID, emoji);
                        console.log(`User ${userID} reacted with ${emoji} to message ${messageID} in group ${groupID}`);

                        // Gamification: +3 points for reaction received
                        const message = await getMessageById(groupID, messageID);
                        if (message && message.senderID !== userID) { // Don't give points for reacting to self
                            await incrementUserPoints(message.senderID, GAMIFICATION_POINTS.REACTION_RECEIVED);
                        }
                        // Update will be broadcast via Firebase listener triggered by addReaction
                        break;
                    }
                    case 'remove_reaction': {
                        const { groupID, messageID, userID, emoji } = payload;
                        if (!groupID || !messageID || !userID || !emoji) {
                            ws.send(JSON.stringify({ type: 'error', payload: 'Missing reaction fields.' }));
                            return;
                        }
                        await removeReaction(groupID, messageID, userID, emoji);
                        console.log(`User ${userID} removed reaction ${emoji} from message ${messageID} in group ${groupID}`);
                        // Update will be broadcast via Firebase listener triggered by removeReaction
                        break;
                    }
                    case 'typing': {
                        await handleTyping(ws, payload);
                        break;
                    }
                    default:
                        ws.send(JSON.stringify({ type: 'error', payload: 'Unknown WebSocket message type.' }));
                        break;
                }
            } catch (error) {
                console.error('WebSocket message parsing error or handler error:', error);
                ws.send(JSON.stringify({ type: 'error', payload: 'Failed to process message.', details: error.message }));
            }
        });

        ws.on('close', () => {
            console.log('Client disconnected from WebSocket.');
            // Clean up clients map and group subscriptions
            if (ws._userID) {
                clients.delete(ws._userID);
                groupSubscriptions.forEach((subscribers, groupID) => {
                    subscribers.delete(ws._userID);
                    if (subscribers.size === 0) {
                        groupSubscriptions.delete(groupID);
                    }
                });
                // Remove Firebase listeners associated with this WebSocket
                if (ws._firebaseListeners) {
                    for (const path in ws._firebaseListeners) {
                        db.ref(path).off('child_added', ws._firebaseListeners[path]);
                        db.ref(path).off('child_changed', ws._firebaseListeners[path]);
                        db.ref(path).off('value', ws._firebaseListeners[path]); // For typing indicators
                    }
                }
                // Clear any pending typing timeouts for this user
                typingTimeouts.forEach((groupUserTimeouts, groupID) => {
                    if (groupUserTimeouts.has(ws._userID)) {
                        clearTimeout(groupUserTimeouts.get(ws._userID));
                        groupUserTimeouts.delete(ws._userID);
                        if (groupUserTimeouts.size === 0) {
                            typingTimeouts.delete(groupID);
                        }
                    }
                });
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    // You can also add Firebase listeners globally here if needed,
    // e.g., for new group chat creations to broadcast to all connected users.
    const groupChatsRef = db.ref('group_chats');
    groupChatsRef.on('child_added', (snapshot) => {
        const newGroupChat = { id: snapshot.key, ...snapshot.val() };
        console.log('Firebase: New group chat created:', newGroupChat.name);
        broadcastToAll({
            type: 'chat_created',
            payload: { groupChat: newGroupChat }
        });
    });
    // This listener can be further optimized, e.g., only send to users on the homepage.

    // Leaderboard update listener
    const usersRef = db.ref('users');
    usersRef.orderByChild('points').limitToLast(10).on('value', (snapshot) => {
        const leaderboardData = [];
        snapshot.forEach(childSnapshot => {
            const user = childSnapshot.val();
            leaderboardData.unshift({ // unshift to get descending order for points
                userID: childSnapshot.key,
                username: user.username,
                points: user.points
            });
        });
        console.log('Firebase: Leaderboard updated');
        broadcastToAll({
            type: 'leaderboard_update',
            payload: { leaderboard: leaderboardData }
        });
    });
};

module.exports = initializeWebSocket;