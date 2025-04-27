const axios = require('axios');

// Daraja API credentials from environment variables
const CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET;
const SHORTCODE = process.env.MPESA_SHORTCODE;
const PASSKEY = process.env.MPESA_PASSKEY;
const CALLBACK_URL = process.env.MPESA_CALLBACK_URL || 'https://your-backend-url.railway.app/api/mpesa/callback';

// Generate timestamp in the format YYYYMMDDHHmmss
const getTimestamp = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}${hours}${minutes}${seconds}`;
};

// Generate OAuth token
async function getOAuthToken() {
    try {
        const auth = Buffer.from(`${CONSUMER_KEY}:${CONSUMER_SECRET}`).toString('base64');
        const response = await axios({
            url: 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
            method: 'get',
            headers: {
                'Authorization': `Basic ${auth}`
            }
        });

        return response.data.access_token;
    } catch (error) {
        console.error('Error generating OAuth token:', error);
        throw new Error('Failed to generate OAuth token');
    }
}

// Initiate STK Push
async function initiateSTKPush(phoneNumber, amount, orderRef, accountRef = 'Loris Kenya') {
    try {
        // Format the phone number to required format (254XXXXXXXXX)
        if (phoneNumber.startsWith('0')) {
            phoneNumber = '254' + phoneNumber.substring(1);
        } else if (!phoneNumber.startsWith('254')) {
            phoneNumber = '254' + phoneNumber;
        }

        // Get OAuth token first
        const token = await getOAuthToken();

        // Generate timestamp
        const timestamp = getTimestamp();

        // Generate password
        const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

        // Request body
        const requestBody = {
            BusinessShortCode: SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: Math.round(amount),
            PartyA: phoneNumber,
            PartyB: SHORTCODE,
            PhoneNumber: phoneNumber,
            CallBackURL: CALLBACK_URL,
            AccountReference: accountRef,
            TransactionDesc: `Payment for order ${orderRef}`
        };

        // Make the request to initiate STK Push
        const response = await axios({
            url: 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
            method: 'post',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: requestBody
        });

        return response.data;
    } catch (error) {
        console.error('STK Push error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.errorMessage || 'Failed to initiate payment');
    }
}

// Check transaction status
async function checkTransactionStatus(checkoutRequestID) {
    try {
        // Get OAuth token first
        const token = await getOAuthToken();

        // Generate timestamp
        const timestamp = getTimestamp();

        // Generate password
        const password = Buffer.from(`${SHORTCODE}${PASSKEY}${timestamp}`).toString('base64');

        // Request body for status check
        const requestBody = {
            BusinessShortCode: SHORTCODE,
            Password: password,
            Timestamp: timestamp,
            CheckoutRequestID: checkoutRequestID
        };

        // Make the request to check status
        const response = await axios({
            url: 'https://sandbox.safaricom.co.ke/mpesa/stkpushquery/v1/query',
            method: 'post',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            data: requestBody
        });

        return response.data;
    } catch (error) {
        console.error('Status check error:', error.response?.data || error.message);
        throw new Error('Failed to check transaction status');
    }
}

module.exports = {
    initiateSTKPush,
    checkTransactionStatus
};