const express = require('express');
const router = express.Router();
const mpesaService = require('../services/mpesa');

// Endpoint to initiate STK Push
router.post('/initiate', async (req, res, next) => {
    try {
        const { phoneNumber, amount, orderId } = req.body;

        if (!phoneNumber || !amount || !orderId) {
            return res.status(400).json({
                success: false,
                message: 'Phone number, amount, and order ID are required'
            });
        }

        const result = await mpesaService.initiateSTKPush(
            phoneNumber,
            amount,
            orderId
        );

        res.json({
            success: true,
            message: 'STK push initiated successfully',
            data: result
        });
    } catch (error) {
        console.error('Error initiating payment:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to initiate payment'
        });
    }
});

// Endpoint to check transaction status
router.post('/status', async (req, res, next) => {
    try {
        const { checkoutRequestID } = req.body;

        if (!checkoutRequestID) {
            return res.status(400).json({
                success: false,
                message: 'Checkout request ID is required'
            });
        }

        const result = await mpesaService.checkTransactionStatus(checkoutRequestID);

        res.json({
            success: true,
            message: 'Transaction status retrieved',
            data: result
        });
    } catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to check transaction status'
        });
    }
});

// Callback endpoint for M-PESA
router.post('/callback', (req, res) => {
    try {
        // Process the callback from M-PESA
        const data = req.body;
        console.log('M-PESA Callback received:', data);

        // Here you would typically:
        // 1. Verify the transaction
        // 2. Update order status in your database
        // 3. Possibly trigger a webhook to notify your frontend

        // Respond to Safaricom
        res.status(200).json({
            ResultCode: 0,
            ResultDesc: 'Callback received successfully'
        });
    } catch (error) {
        console.error('Error processing M-PESA callback:', error);
        res.status(500).json({
            ResultCode: 1,
            ResultDesc: 'Failed to process callback'
        });
    }
});

module.exports = router;