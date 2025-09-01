// src/server.js
require('dotenv').config();
const http = require('http');
const app = require('./app');
const initializeWebSocket = require('./utils/websocket');
const firebaseAdmin = require('./config/firebase'); // Ensure Firebase is initialized

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
initializeWebSocket(server);

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('Firebase Admin SDK initialized.');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        process.exit(0);
    });
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Optionally, perform graceful shutdown or just log
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    // This is a critical error, often requires restarting the process
    process.exit(1);
});