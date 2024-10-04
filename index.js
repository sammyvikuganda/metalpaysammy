const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firebase Admin SDK
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: "https://metal-pay-55c31-default-rtdb.firebaseio.com/",
});

// Middleware
app.use(cors());
app.use(express.json());

// Create a new user with a specified user ID
app.post('/api/create-user', async (req, res) => {
    const { userId } = req.body;
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        if (userSnapshot.exists()) {
            return res.status(400).json({ message: 'User ID already exists' });
        }

        const userData = {
            capital: 10000,
            growingMoney: 0,
            referralEarnings: 0,
            referralEarningsBonus: 0,
            totalGained: 0,
            totalInvested: 0,
            lastUpdated: Date.now(),
            transactionHistory: [],
            referrals: []
        };

        await admin.database().ref(`users/${userId}`).set(userData);
        res.json({ userId });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
});

// Endpoint to receive and store payment order details under the specific user
app.post('/api/payment-order', async (req, res) => {
    const { amount, price, quantity, date, sellerName, sellerPhoneNumber, transactionId, userId } = req.body;

    if (!amount || !price || !quantity || !date || !sellerName || !sellerPhoneNumber || !transactionId || !userId) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    try {
        // Check if user exists
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        if (!userSnapshot.exists()) {
            return res.status(404).json({ message: 'User not found' });
        }

        const newOrder = {
            amount,
            price,
            quantity,
            date,
            sellerName,
            sellerPhoneNumber,
            transactionId,
            messages: [], // Only keep messages as an array
            status: 'Pending',
            createdAt: Date.now(),
        };

        // Push the order into the user's paymentOrders
        await admin.database().ref(`users/${userId}/paymentOrders`).push(newOrder);
        res.status(200).json({ message: 'Payment order saved successfully' });
    } catch (error) {
        console.error('Error saving payment order:', error);
        res.status(500).json({ message: 'Error saving payment order' });
    }
});

// Endpoint to fetch all payment orders for a specific user
app.get('/api/payment-orders/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}/paymentOrders`).once('value');
        const orders = snapshot.val();

        if (!orders) {
            return res.status(404).json({ message: 'No payment orders found for this user' });
        }

        // Convert the orders object into an array
        const ordersArray = Object.entries(orders).map(([id, order]) => ({
            id,
            ...order,
            remainingTime: 15 * 60 * 1000 - (Date.now() - order.createdAt) // Calculate remaining time
        }));

        res.json(ordersArray);
    } catch (error) {
        console.error('Error fetching payment orders:', error);
        res.status(500).json({ message: 'Error fetching payment orders' });
    }
});

// Endpoint to fetch the status of an order by order ID
app.get('/api/payment-orders/:userId/:id', async (req, res) => {
    const { userId, id } = req.params;
    try {
        const orderSnapshot = await admin.database().ref(`users/${userId}/paymentOrders/${id}`).once('value');
        const order = orderSnapshot.val();

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const remainingTime = 15 * 60 * 1000 - (Date.now() - order.createdAt);
        const isExpired = remainingTime <= 0;

        res.json({
            id,
            ...order,
            remainingTime,
            isExpired,
        });
    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ message: 'Error fetching order status' });
    }
});

// New Endpoint to fetch all orders by `creatorId`
app.get('/api/payment-orders/creator/:creatorId', async (req, res) => {
    const { creatorId } = req.params;

    try {
        const snapshot = await admin.database().ref('paymentOrders').orderByChild('creatorId').equalTo(creatorId).once('value');
        const orders = snapshot.val();

        if (!orders) {
            return res.status(404).json({ message: 'No orders found for this creator' });
        }

        // Convert the orders object into an array
        const ordersArray = Object.entries(orders).map(([id, order]) => ({
            id,
            ...order,
            remainingTime: 15 * 60 * 1000 - (Date.now() - order.createdAt) // Calculate remaining time
        }));

        res.json(ordersArray);
    } catch (error) {
        console.error('Error fetching orders for creator:', error);
        res.status(500).json({ message: 'Error fetching orders for creator' });
    }
});

// Endpoint to send a message to an existing order by transaction ID
app.post('/api/payment-order/message', async (req, res) => {
    const { transactionId, message } = req.body;

    if (!transactionId || !message) {
        return res.status(400).json({ message: 'Transaction ID and message are required' });
    }

    try {
        // Find the order by transaction ID within the user's paymentOrders
        const ordersSnapshot = await admin.database().ref('users').once('value');
        const users = ordersSnapshot.val();
        let orderFound = false;

        for (const userId in users) {
            const userOrders = users[userId].paymentOrders;
            if (userOrders) {
                const orderId = Object.keys(userOrders).find(id => userOrders[id].transactionId === transactionId);
                if (orderId) {
                    // Update the order by pushing the new message into the messages array
                    await admin.database().ref(`users/${userId}/paymentOrders/${orderId}/messages`).push({
                        text: message,
                        timestamp: Date.now()
                    });
                    orderFound = true;
                    break; // Exit loop after finding and updating the order
                }
            }
        }

        if (!orderFound) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.status(200).json({ message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ message: 'Error sending message' });
    }
});

// Endpoint to fetch messages for a specific order by transaction ID
app.get('/api/payment-order/messages/:transactionId', async (req, res) => {
    const { transactionId } = req.params;

    try {
        // Find the order by transaction ID within the user's paymentOrders
        const ordersSnapshot = await admin.database().ref('users').once('value');
        const users = ordersSnapshot.val();
        let orderFound = false;
        let messages = [];

        for (const userId in users) {
            const userOrders = users[userId].paymentOrders;
            if (userOrders) {
                const orderId = Object.keys(userOrders).find(id => userOrders[id].transactionId === transactionId);
                if (orderId) {
                    messages = userOrders[orderId].messages || [];
                    orderFound = true;
                    break; // Exit loop after finding the order
                }
            }
        }

        if (!orderFound) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json({ transactionId, messages });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Error fetching messages' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
