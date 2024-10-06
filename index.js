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

// Function to generate a new transaction ID
const generateTransactionId = () => {
    const randomDigits = Math.floor(1000000 + Math.random() * 9000000).toString(); // Generates a random 7-digit number
    return `NXS${randomDigits}`; // Prepend "NXS" to the random number
};

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
    const { amount, price, quantity, sellerName, sellerPhoneNumber, userId, orderSenderId, orderNotice } = req.body;

    if (!amount || !price || !quantity || !sellerName || !sellerPhoneNumber || !userId || !orderSenderId) {
        return res.status(400).json({ message: 'All fields except orderNotice are required' });
    }

    try {
        // Check if user exists
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        if (!userSnapshot.exists()) {
            return res.status(404).json({ message: 'User not found' });
        }

        const transactionId = generateTransactionId(); // Generate the transaction ID
        const newOrder = {
            amount,
            price,
            quantity,
            sellerName,
            sellerPhoneNumber,
            orderSenderId,
            transactionId,
            messages: [],
            createdAt: Date.now(),
            manualStatus: null, // Add manualStatus to orders
            orderNotice: orderNotice || null, // Add orderNotice if provided
            noticeUpdatedAt: null, // Field for tracking when orderNotice was last updated
            noticeUpdateCount: 0 // Count how many times the notice has been updated
        };

        // Push the order into the user's paymentOrders
        await admin.database().ref(`users/${userId}/paymentOrders`).push(newOrder);
        res.status(200).json({ message: 'Payment order saved successfully', transactionId });
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
        const ordersArray = Object.entries(orders).map(([id, order]) => {
            const remainingTime = 15 * 60 * 1000 - (Date.now() - order.createdAt);
            const isExpired = remainingTime <= 0;
            const autoStatus = isExpired ? 'Expired' : 'Pending';

            return {
                id,
                ...order,
                remainingTime,
                status: order.manualStatus || autoStatus, // Prioritize manual status if available
                orderNotice: order.orderNotice || null, // Include order notice
                noticeUpdatedAt: order.noticeUpdatedAt || null // Include last updated time for notice
            };
        });

        res.json(ordersArray);
    } catch (error) {
        console.error('Error fetching payment orders:', error);
        res.status(500).json({ message: 'Error fetching payment orders' });
    }
});


// New Endpoint to fetch all payment orders by `orderSenderId`
app.get('/api/payment-orders-sender/:orderSenderId', async (req, res) => {
    const { orderSenderId } = req.params;
    try {
        const snapshot = await admin.database().ref('users').once('value');
        const users = snapshot.val();
        let ordersArray = [];

        for (const userId in users) {
            const userOrders = users[userId].paymentOrders;
            if (userOrders) {
                const filteredOrders = Object.entries(userOrders)
                    .filter(([_, order]) => order.orderSenderId === orderSenderId)
                    .map(([id, order]) => {
                        const remainingTime = 15 * 60 * 1000 - (Date.now() - order.createdAt);
                        const isExpired = remainingTime <= 0;
                        const autoStatus = isExpired ? 'Expired' : 'Pending';

                        return {
                            id,
                            ...order,
                            remainingTime,
                            status: order.manualStatus || autoStatus, // Prioritize manual status if available
                            orderNotice: order.orderNotice || null, // Include order notice
                            noticeUpdatedAt: order.noticeUpdatedAt || null // Include last updated time for notice
                        };
                    });

                ordersArray = [...ordersArray, ...filteredOrders];
            }
        }

        if (ordersArray.length === 0) {
            return res.status(404).json({ message: 'No payment orders found for this sender' });
        }

        res.json(ordersArray);
    } catch (error) {
        console.error('Error fetching payment orders by sender:', error);
        res.status(500).json({ message: 'Error fetching payment orders by sender' });
    }
});


// Endpoint to fetch the status of an order by transaction ID
app.get('/api/payment-orders/transaction/:transactionId', async (req, res) => {
    const { transactionId } = req.params;
    try {
        const ordersSnapshot = await admin.database().ref('users').once('value');
        const users = ordersSnapshot.val();
        let orderFound = false;
        let orderData = {};

        // Iterate through all users and their orders
        for (const userId in users) {
            const userOrders = users[userId].paymentOrders;
            if (userOrders) {
                const orderId = Object.keys(userOrders).find(id => userOrders[id].transactionId === transactionId);
                if (orderId) {
                    const order = userOrders[orderId];
                    const remainingTime = 15 * 60 * 1000 - (Date.now() - order.createdAt);
                    const isExpired = remainingTime <= 0;

                    orderData = {
                        transactionId,
                        ...order,
                        remainingTime,
                        status: isExpired ? 'Expired' : 'Pending', // Determine status based on time
                    };
                    orderFound = true;
                    break;
                }
            }
        }

        if (!orderFound) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json(orderData);
    } catch (error) {
        console.error('Error fetching order status:', error);
        res.status(500).json({ message: 'Error fetching order status' });
    }
});

// Endpoint to send a message to an existing order by transaction ID
app.post('/api/payment-order/message', async (req, res) => {
    const { transactionId, message } = req.body;

    if (!transactionId || !message) {
        return res.status(400).json({ message: 'Transaction ID and message are required' });
    }

    try {
        const ordersSnapshot = await admin.database().ref('users').once('value');
        const users = ordersSnapshot.val();
        let orderFound = false;

        for (const userId in users) {
            const userOrders = users[userId].paymentOrders;
            if (userOrders) {
                const orderId = Object.keys(userOrders).find(id => userOrders[id].transactionId === transactionId);
                if (orderId) {
                    await admin.database().ref(`users/${userId}/paymentOrders/${orderId}/messages`).push({
                        text: message,
                        timestamp: Date.now()
                    });
                    orderFound = true;
                    break;
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
                    break;
                }
            }
        }

        if (!orderFound) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.json({ messages });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ message: 'Error fetching messages' });
    }
});



// Endpoint to manually update the status of an order
app.put('/api/payment-order/status/:transactionId', async (req, res) => {
    const { transactionId } = req.params;
    const { manualStatus } = req.body;

    if (!manualStatus || !['Completed', 'Canceled'].includes(manualStatus)) {
        return res.status(400).json({ message: 'Invalid status' });
    }

    try {
        const ordersSnapshot = await admin.database().ref('users').once('value');
        const users = ordersSnapshot.val();
        let orderFound = false;

        for (const userId in users) {
            const userOrders = users[userId].paymentOrders;
            if (userOrders) {
                const orderId = Object.keys(userOrders).find(id => userOrders[id].transactionId === transactionId);
                if (orderId) {
                    await admin.database().ref(`users/${userId}/paymentOrders/${orderId}`).update({
                        manualStatus: manualStatus
                    });
                    orderFound = true;
                    break;
                }
            }
        }

        if (!orderFound) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.status(200).json({ message: `Order status updated to ${manualStatus}` });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ message: 'Error updating order status' });
    }
});


// Endpoint to update the order notice for a specific order
app.put('/api/payment-order/notice/:transactionId', async (req, res) => {
    const { transactionId } = req.params;
    const { orderNotice } = req.body;

    if (!orderNotice) {
        return res.status(400).json({ message: 'Order notice is required' });
    }

    try {
        const ordersSnapshot = await admin.database().ref('users').once('value');
        const users = ordersSnapshot.val();
        let orderFound = false;

        for (const userId in users) {
            const userOrders = users[userId].paymentOrders;
            if (userOrders) {
                const orderId = Object.keys(userOrders).find(id => userOrders[id].transactionId === transactionId);
                if (orderId) {
                    const order = userOrders[orderId];

                    // Update the order notice
                    await admin.database().ref(`users/${userId}/paymentOrders/${orderId}`).update({
                        orderNotice,
                        noticeUpdatedAt: Date.now() // Update the timestamp for when the notice was updated
                    });

                    // Check if the order notice was updated to "Confirmed"
                    if (orderNotice === 'Confirmed') {
                        // Increment the notice update counter
                        const currentUpdateCount = order.noticeUpdateCount || 0;
                        await admin.database().ref(`users/${userId}/paymentOrders/${orderId}`).update({
                            noticeUpdateCount: currentUpdateCount + 1 // Increment the counter
                        });

                        // If the update count reaches 2, update status to Completed
                        if (currentUpdateCount + 1 >= 2) {
                            await admin.database().ref(`users/${userId}/paymentOrders/${orderId}`).update({
                                manualStatus: 'Completed'
                            });
                        }
                    }

                    orderFound = true;
                    break;
                }
            }
        }

        if (!orderFound) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.status(200).json({ message: 'Order notice updated successfully' });
    } catch (error) {
        console.error('Error updating order notice:', error);
        res.status(500).json({ message: 'Error updating order notice' });
    }
});




// Endpoint to fetch notice update count for a specific order by transaction ID
app.get('/api/payment-order/notice-count/:transactionId', async (req, res) => {
    const { transactionId } = req.params;

    try {
        const ordersSnapshot = await admin.database().ref('users').once('value');
        const users = ordersSnapshot.val();
        let orderFound = false;
        let noticeUpdateCount = 0;

        for (const userId in users) {
            const userOrders = users[userId].paymentOrders;
            if (userOrders) {
                const orderId = Object.keys(userOrders).find(id => userOrders[id].transactionId === transactionId);
                if (orderId) {
                    const order = userOrders[orderId];
                    noticeUpdateCount = order.noticeUpdateCount || 0;
                    orderFound = true;
                    break;
                }
            }
        }

        if (!orderFound) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.status(200).json({ transactionId, noticeUpdateCount });
    } catch (error) {
        console.error('Error fetching notice update count:', error);
        res.status(500).json({ message: 'Error fetching notice update count' });
    }
});



// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
