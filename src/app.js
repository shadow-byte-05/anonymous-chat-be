// src/app.js
const express = require('express');
const cors = require('cors');
const userRoutes = require('./routes/userRoutes');
const chatRoutes = require('./routes/chatRoutes');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies

// Routes
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);

// Root path for testing
app.get('/', (req, res) => {
    res.send('Welcome to the Anonymous Chat Backend! WebSocket is also running.');
});

// Error handling middleware
app.use(errorHandler);

module.exports = app;