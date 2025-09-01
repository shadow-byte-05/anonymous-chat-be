// src/utils/constants.js
module.exports = {
    DEFAULT_AVATARS: [
        "https://api.multiavatar.com/anonymous1.png",
        "https://api.multiavatar.com/anonymous2.png",
        "https://api.multiavatar.com/anonymous3.png",
        "https://api.multiavatar.com/anonymous4.png",
        "https://api.multiavatar.com/anonymous5.png",
        // Add more avatar URLs if desired
    ],
    GAMIFICATION_POINTS: {
        MESSAGE_SENT: 1,
        REPLY_RECEIVED: 2,
        REACTION_RECEIVED: 3,
    },
    TYPING_INDICATOR_TIMEOUT_MS: 7000, // Show typing for 7 seconds after last keypress
    TYPING_INDICATOR_BUFFER_MS: 3000, // Client side buffer to send typing status, not directly used here
};