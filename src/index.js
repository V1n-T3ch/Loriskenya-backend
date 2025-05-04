const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

dotenv.config();

// Import route
const storageRoutes = require('./routes/storage');

// Initialize express
const app = express();

// Set up middleware
app.use(helmet()); // Security headers
app.use(morgan('dev')); // Logging
app.use(cors({
    origin: process.env.FRONTEND_URL, // Allow requests from frontend
    methods: ['GET', 'POST', 'DELETE'], // Added DELETE for file deletion
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set up routes
app.use('/api/storage', storageRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong on the server',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Loris Kenya Server running on port ${PORT}`);
});