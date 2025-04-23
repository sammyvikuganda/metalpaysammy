const express = require('express');
const axios = require('axios');
const cors = require('cors');
const admin = require('firebase-admin');
const QRCode = require('qrcode'); // Import the QR code library
const cron = require('node-cron');
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

const db = admin.database();

// Middleware
app.use(cors());
app.use(express.json());

// Function to generate a new transaction ID
const generateTransactionId = () => {
    const randomDigits = Math.floor(1000000 + Math.random() * 9000000).toString(); // Generates a random 7-digit number
    return `NXS${randomDigits}`; // Prepend "NXS" to the random number
};


// Middleware
app.use(cors());
app.use(express.json());



// Chance mapping based on position
const positionChances = {
    1: [8, 3, 4],
    2: [5, 7, 1],
    3: [2, 8, 9],
    4: [9, 6, 3],
    5: [7, 4, 1],
    6: [2, 3, 7],
    7: [5, 1, 6],
    8: [3, 9, 4],
    9: [6, 2, 8],
    10: [1, 4, 5],
    11: [9, 3, 2],
    12: [7, 8, 5],
    13: [4, 1, 6],
    14: [8, 9, 2],
    15: [1, 7, 3],
    16: [6, 2, 8],
    17: [5, 9, 4],
    18: [3, 7, 1],
    19: [8, 6, 5],
    20: [2, 4, 9],
    21: [7, 1, 8],
    22: [3, 5, 4],
    23: [9, 2, 1],
    24: [4, 6, 7],
    25: [1, 9, 5],
    26: [6, 7, 2],
    27: [8, 5, 3],
    28: [4, 1, 9],
    29: [2, 8, 6],
    30: [7, 3, 4],
    31: [5, 1, 2],
    32: [9, 4, 6],
    33: [2, 5, 7],
    34: [8, 1, 3],
    35: [9, 2, 4],
    36: [7, 5, 8],
    37: [3, 9, 1],
    38: [4, 7, 6],
    39: [6, 2, 5],
    40: [1, 8, 9]
};


// The "fruitsGroupedByPayout" object represents the payout structure for each round
const fruitsGroupedByPayout = {
    1: { fruits: [], totalPayout: 0 },
    2: { fruits: [], totalPayout: 0 },
    3: { fruits: [{ type: "🍊", quantity: 2, payout: 200 }], totalPayout: 400 },
    4: { fruits: [], totalPayout: 0 },
    5: { fruits: [{ type: "🍉", quantity: 5, payout: 300 }], totalPayout: 1500 },
    6: { fruits: [{ type: "🍎", quantity: 3, payout: 350 }], totalPayout: 1050 },
    7: { fruits: [{ type: "🥝", quantity: 4, payout: 400 }], totalPayout: 1600 },
    8: { fruits: [], totalPayout: 0 },
    9: { fruits: [{ type: "🍍", quantity: 8, payout: 500 }], totalPayout: 4000 },
    10: { fruits: [{ type: "🍓", quantity: 2, payout: 550 }], totalPayout: 1100 },
    11: { fruits: [], totalPayout: 0 },
    12: { fruits: [{ type: "🍏", quantity: 12, payout: 650 }], totalPayout: 7800 },
    13: { fruits: [{ type: "🍑", quantity: 6, payout: 700 }], totalPayout: 4200 },
    14: { fruits: [], totalPayout: 0 },
    15: { fruits: [{ type: "🍇", quantity: 7, payout: 800 }], totalPayout: 5600 },
    16: { fruits: [{ type: "🍎", quantity: 9, payout: 850 }], totalPayout: 7650 },
    17: {
        fruits: [
            { type: "🍒", quantity: 2, payout: 100 },
            { type: "🍓", quantity: 2, payout: 550 }
        ],
        totalPayout: (2 * 100) + (2 * 550)
    },
    18: { fruits: [{ type: "🥥", quantity: 11, payout: 950 }], totalPayout: 10450 },
    19: {
        fruits: [
            { type: "🍊", quantity: 5, payout: 200 },
            { type: "🍌", quantity: 5, payout: 200 }
        ],
        totalPayout: (5 * 200) + (5 * 200)
    },
    20: {
        fruits: [
            { type: "🍉", quantity: 7, payout: 150 },
            { type: "🍎", quantity: 5, payout: 350 }
        ],
        totalPayout: (7 * 150) + (5 * 350)
    },
    21: { fruits: [{ type: "🍎", quantity: 12, payout: 1200 }], totalPayout: 14400 },
    22: {
        fruits: [
            { type: "🍒", quantity: 6, payout: 100 },
            { type: "🍓", quantity: 6, payout: 550 }
        ],
        totalPayout: (6 * 100) + (6 * 550)
    },
    23: {
        fruits: [
            { type: "🥥", quantity: 6, payout: 950 },
            { type: "🍍", quantity: 5, payout: 500 }
        ],
        totalPayout: (6 * 950) + (5 * 500)
    },
    24: {
        fruits: [
            { type: "🍇", quantity: 6, payout: 800 },
            { type: "🍎", quantity: 6, payout: 850 }
        ],
        totalPayout: (6 * 800) + (6 * 850)
    },
    25: {
        fruits: [
            { type: "🍓", quantity: 7, payout: 550 },
            { type: "🍏", quantity: 5, payout: 650 }
        ],
        totalPayout: (7 * 550) + (5 * 650)
    },

26: { fruits: [{ type: "🍊", quantity: 5, payout: 250 }], totalPayout: 1250 },
27: { fruits: [{ type: "🍓", quantity: 4, payout: 500 }], totalPayout: 2000 },
28: { fruits: [{ type: "🍇", quantity: 8, payout: 600 }], totalPayout: 4800 },
29: { fruits: [{ type: "🍏", quantity: 3, payout: 700 }], totalPayout: 2100 },
30: { fruits: [{ type: "🍒", quantity: 6, payout: 400 }], totalPayout: 2400 },

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
            referrals: [],
            reactions: { 
                likes: 0,
                dislikes: 0,
                comments: []
                },
            loses: 0
        };

        await admin.database().ref(`users/${userId}`).set(userData);

        // Generate a QR code for the user ID
        const qrCodeDataUrl = await QRCode.toDataURL(userId);

        // Respond with user ID and QR code
        res.status(201).json({
            userId,
            qrCode: qrCodeDataUrl // This is the base64 encoded QR code image
        });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
});


// Fetch user details along with QR code
app.get('/api/user-details/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = snapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Generate a QR code for the user ID
        const qrCodeDataUrl = await QRCode.toDataURL(userId);

        // Send back the user data along with the QR code
        res.json({
            ...userData, // Spread the user data
            userId,
            qrCode: qrCodeDataUrl // Include the QR code as a base64 encoded image
        });
    } catch (error) {
        console.error('Error fetching user details:', error);
        res.status(500).json({ message: 'Error fetching user details' });
    }
});


// Endpoint to receive and store payment order details under the specific user
app.post('/api/payment-order', async (req, res) => {
    const { amount, price, quantity, sellerName, sellerPhoneNumber,orderType, paymentMethod, orderAdvice, userId, orderSenderId, orderNotice } = req.body;

    if (!amount || !price || !quantity || !sellerName || !sellerPhoneNumber || !orderType || !paymentMethod || !userId || !orderSenderId) {
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
            paymentMethod,
            orderType,
            orderSenderId,
            transactionId,
            messages: [],
            createdAt: Date.now(),
            orderAdvice: orderAdvice || null,
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
                        noticeUpdatedAt: order.noticeUpdatedAt || null, // Include last updated time for notice
       orderType: order.orderType,
      orderAdvice: order.orderAdvice || null,
paymentMethod: order.paymentMethod || null
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
                        noticeUpdatedAt: order.noticeUpdatedAt || null, // Include last updated time for notice
       orderType: order.orderType,
      orderAdvice: order.orderAdvice || null,
paymentMethod: order.paymentMethod || null
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
    const { transactionId, message, sender } = req.body; // Add 'sender'

    if (!transactionId || !message || sender === undefined) { // Check if sender is provided
        return res.status(400).json({ message: 'Transaction ID, message, and sender are required' });
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
                        sender: sender, // Add the sender field to the message
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

                    // Check if it's the first update
                    const isFirstUpdate = !order.noticeUpdatedAt;

                    // Get the current time for updates
                    const currentTime = Date.now();

                    // If it's the first update, extend the expiration time and reset remainingTime
                    if (isFirstUpdate) {
                        const newExpirationTime = currentTime + 15 * 60 * 1000; // Add 15 minutes
                        const updatedRemainingTime = 15 * 60 * 1000; // 15 minutes in milliseconds

                        await admin.database().ref(`users/${userId}/paymentOrders/${orderId}`).update({
                            createdAt: currentTime, // Set the new creation time as the current time
                            remainingTime: updatedRemainingTime, // Reset the remaining time
                            expirationTime: newExpirationTime // Extend the expiration time
                        });
                    }

                    // Update the order notice and notice timestamp
                    await admin.database().ref(`users/${userId}/paymentOrders/${orderId}`).update({
                        orderNotice,
                        noticeUpdatedAt: currentTime, // Update the timestamp for when the notice was updated
                        noticeUpdateCount: (order.noticeUpdateCount || 0) + 1 // Increment the counter
                    });

                    // Increment the notice update counter only for specific orderNotice values
                    if (['Confirmed', 'Completed'].includes(orderNotice)) {
                        const currentUpdateCount = order.noticeUpdateCount || 0;

                        // If the update count reaches 2, update the status to Completed
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




// Endpoint to fetch all payment orders for all users
app.get('/api/payment-orders', async (req, res) => {
    try {
        const snapshot = await admin.database().ref('users').once('value');
        const users = snapshot.val();
        let ordersArray = [];

        for (const userId in users) {
            const userOrders = users[userId].paymentOrders;
            if (userOrders) {
                const userOrdersArray = Object.entries(userOrders).map(([id, order]) => {
                    const remainingTime = 15 * 60 * 1000 - (Date.now() - order.createdAt);
                    const isExpired = remainingTime <= 0;
                    const autoStatus = isExpired ? 'Expired' : 'Pending';

                    return {
                        id,
                        userId,
                        ...order,
                        remainingTime,
                        status: order.manualStatus || autoStatus, // Prioritize manual status if available
                        orderNotice: order.orderNotice || null, // Include order notice
                        noticeUpdatedAt: order.noticeUpdatedAt || null, // Include last updated time for notice
       orderType: order.orderType,
      orderAdvice: order.orderAdvice || null,
paymentMethod: order.paymentMethod || null
                    };
                });

                ordersArray = [...ordersArray, ...userOrdersArray];
            }
        }

        if (ordersArray.length === 0) {
            return res.status(404).json({ message: 'No payment orders found for any users' });
        }

        res.json(ordersArray);
    } catch (error) {
        console.error('Error fetching all payment orders:', error);
        res.status(500).json({ message: 'Error fetching all payment orders' });
    }
});




// Endpoint to update the order advice for a specific order
app.put('/api/payment-order/advice/:transactionId', async (req, res) => {
    const { transactionId } = req.params;
    const { orderAdvice } = req.body;

    if (!orderAdvice) {
        return res.status(400).json({ message: 'Order advice is required' });
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
                    // Update the order advice
                    await admin.database().ref(`users/${userId}/paymentOrders/${orderId}`).update({
                        orderAdvice
                    });

                    orderFound = true;
                    break;
                }
            }
        }

        if (!orderFound) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.status(200).json({ message: 'Order advice updated successfully' });
    } catch (error) {
        console.error('Error updating order advice:', error);
        res.status(500).json({ message: 'Error updating order advice' });
    }
});





// Create a new advert with updated fields
app.post('/api/adverts', async (req, res) => {
    const { 
        advertiserNotice, 
        price, 
        airtelNumber, 
        mtnNumber, 
        chipperTag, 
        bankAccountNumber,
        cryptoTransferAddress, 
        userId, // This acts as both the advert owner and title
        minAmount, 
        maxAmount, 
        availableQuantity, 
        timeLimit,
        advertType // New field for advert type
    } = req.body;

    // Ensure all required fields are provided
    if (!advertiserNotice || !price || !userId || !minAmount || !maxAmount || !availableQuantity || !timeLimit || !advertType) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate advertType to be either 'sell' or 'buy'
    if (!['sell', 'buy'].includes(advertType)) {
        return res.status(400).json({ message: 'Advert type must be either "sell" or "buy"' });
    }

    try {
        const advertId = generateTransactionId(); // Generate a unique ID for the advert

        const newAdvert = {
            advertOwner: userId, // This acts as the title
            advertiserNotice, // Advertiser notice field
            price,
            paymentMethods: {
                airtelNumber, 
                mtnNumber, 
                chipperTag, 
                bankAccountNumber,
                cryptoTransferAddress 
            },
            limits: {
                minAmount, 
                maxAmount 
            },
            availableQuantity, 
            timeLimit: timeLimit || 30, 
            advertStatus: 'Active',
            advertType // Save the advert type
        };

        // Save the new advert under the user's adverts
        await admin.database().ref(`users/${userId}/adverts/${advertId}`).set(newAdvert);
        res.status(200).json({ message: 'Advert created successfully', advertId });
    } catch (error) {
        console.error('Error creating advert:', error);
        res.status(500).json({ message: 'Error creating advert' });
    }
});

// Fetch all adverts for a user
app.get('/api/:userId/adverts', async (req, res) => {
    const { userId } = req.params;
    
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}/adverts`).once('value');
        if (!userSnapshot.exists()) {
            return res.status(404).json({ message: 'No adverts found for this user' });
        }

        const adverts = userSnapshot.val();
        res.json({ adverts });
    } catch (error) {
        console.error('Error fetching adverts:', error);
        res.status(500).json({ message: 'Error fetching adverts' });
    }
});

// Update advert details
app.put('/api/adverts/:userId/:advertId', async (req, res) => {
    const { userId, advertId } = req.params;
    const { 
        advertiserNotice, 
        price, 
        airtelNumber, 
        mtnNumber, 
        chipperTag, 
        bankAccountNumber,
        cryptoTransferAddress, 
        minAmount, 
        maxAmount, 
        availableQuantity, 
        timeLimit, 
        advertStatus,
        advertType // New field for advert type
    } = req.body;

    // Ensure all required fields are provided, including advertType
    if (!advertiserNotice || !price || !minAmount || !maxAmount || !availableQuantity || !timeLimit || !advertStatus || !advertType) {
        return res.status(400).json({ message: 'All fields are required' });
    }

    // Validate advertType to be either 'sell' or 'buy'
    if (!['sell', 'buy'].includes(advertType)) {
        return res.status(400).json({ message: 'Advert type must be either "sell" or "buy"' });
    }

    try {
        const updatedAdvert = {
            advertOwner: userId, // This acts as the title
            advertiserNotice, // Advertiser notice field
            price,
            paymentMethods: {
                airtelNumber, 
                mtnNumber, 
                chipperTag, 
                bankAccountNumber,
                cryptoTransferAddress 
            },
            limits: {
                minAmount,
                maxAmount
            },
            availableQuantity,
            timeLimit, 
            advertStatus, 
            advertType, // Save the advert type
            updatedAt: Date.now() // Update timestamp
        };

        // Update the advert in the user's advert collection
        await admin.database().ref(`users/${userId}/adverts/${advertId}`).update(updatedAdvert);
        res.status(200).json({ message: 'Advert updated successfully' });
    } catch (error) {
        console.error('Error updating advert:', error);
        res.status(500).json({ message: 'Error updating advert' });
    }
});

// Delete an advert for a user
app.delete('/api/:userId/adverts/:advertId', async (req, res) => {
    const { userId, advertId } = req.params;

    try {
        // Check if the user exists
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        if (!userSnapshot.exists()) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Check if the advert exists for the user
        const advertSnapshot = await admin.database().ref(`users/${userId}/adverts/${advertId}`).once('value');
        if (!advertSnapshot.exists()) {
            return res.status(404).json({ message: 'Advert not found' });
        }

        // Delete the advert
        await admin.database().ref(`users/${userId}/adverts/${advertId}`).remove();

        res.json({ message: 'Advert deleted successfully' });
    } catch (error) {
        console.error('Error deleting advert:', error);
        res.status(500).json({ message: 'Error deleting advert' });
    }
});



// Fetch all adverts for all users
app.get('/api/adverts', async (req, res) => {
    try {
        const usersSnapshot = await admin.database().ref('users').once('value');
        if (!usersSnapshot.exists()) {
            return res.status(404).json({ message: 'No users found' });
        }

        const allAdverts = {};
        usersSnapshot.forEach(userSnapshot => {
            const userId = userSnapshot.key;
            const adverts = userSnapshot.val().adverts || {};
            allAdverts[userId] = adverts; // Store adverts under the respective user ID
        });

        res.json({ allAdverts });
    } catch (error) {
        console.error('Error fetching all adverts:', error);
        res.status(500).json({ message: 'Error fetching all adverts' });
    }
});





// Update advert status only
app.put('/api/adverts/status/:userId/:advertId', async (req, res) => {
    const { userId, advertId } = req.params;
    const { advertStatus } = req.body; // Extract the new advert status from the request body

    // Ensure the advertStatus field is provided
    if (!advertStatus) {
        return res.status(400).json({ message: 'Advert status is required' });
    }

    // Validate advertStatus to be one of the expected values
    const validStatuses = ['Active', 'Inactive', 'Completed']; // Adjust this list based on your requirements
    if (!validStatuses.includes(advertStatus)) {
        return res.status(400).json({ message: `Advert status must be one of the following: ${validStatuses.join(', ')}` });
    }

    try {
        // Check if the advert exists for the user
        const advertSnapshot = await admin.database().ref(`users/${userId}/adverts/${advertId}`).once('value');
        if (!advertSnapshot.exists()) {
            return res.status(404).json({ message: 'Advert not found' });
        }

        // Update only the advert status
        await admin.database().ref(`users/${userId}/adverts/${advertId}`).update({ advertStatus });

        res.status(200).json({ message: 'Advert status updated successfully' });
    } catch (error) {
        console.error('Error updating advert status:', error);
        res.status(500).json({ message: 'Error updating advert status' });
    }
});







// Endpoint to like a user
app.post('/api/like/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        if (!userSnapshot.exists()) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userData = userSnapshot.val();
        const currentReactions = userData.reactions || { likes: 0, dislikes: 0, comments: [] };

        // Increase the likes count
        currentReactions.likes += 1;

        // Update the user's reactions
        await admin.database().ref(`users/${userId}/reactions`).update(currentReactions);
        res.status(200).json({ message: 'User liked successfully', likes: currentReactions.likes });
    } catch (error) {
        console.error('Error liking user:', error);
        res.status(500).json({ message: 'Error liking user' });
    }
});

// Endpoint to dislike a user
app.post('/api/dislike/:userId', async (req, res) => {
    const { userId } = req.params;

    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        if (!userSnapshot.exists()) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userData = userSnapshot.val();
        const currentReactions = userData.reactions || { likes: 0, dislikes: 0, comments: [] };

        // Increase the dislikes count
        currentReactions.dislikes += 1;

        // Update the user's reactions
        await admin.database().ref(`users/${userId}/reactions`).update(currentReactions);
        res.status(200).json({ message: 'User disliked successfully', dislikes: currentReactions.dislikes });
    } catch (error) {
        console.error('Error disliking user:', error);
        res.status(500).json({ message: 'Error disliking user' });
    }
});

// Endpoint to post a comment for a user
app.post('/api/comment/:userId', async (req, res) => {
    const { userId } = req.params;
    const { commentText, commenterId } = req.body;

    if (!commentText) {
        return res.status(400).json({ message: 'Comment text is required' });
    }

    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        if (!userSnapshot.exists()) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userData = userSnapshot.val();
        const currentReactions = userData.reactions || { likes: 0, dislikes: 0, comments: [] };

        // Ensure comments is initialized as an array
        if (!Array.isArray(currentReactions.comments)) {
            currentReactions.comments = [];
        }

        // Create a new comment object
        const newComment = {
            text: commentText,
            commenterId: commenterId || null, // Set to null if not provided
            timestamp: Date.now()
        };

        // Add the new comment to the comments array
        currentReactions.comments.push(newComment);

        // Update the user's reactions with the new comment
        await admin.database().ref(`users/${userId}/reactions`).update(currentReactions);

        res.status(200).json({ message: 'Comment added successfully' });
    } catch (error) {
        console.error('Error posting comment:', error);
        res.status(500).json({ message: 'Error posting comment' });
    }
});




// Endpoint to fetch reactions and comments for a specific user
app.get('/api/reactions/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}/reactions`).once('value');

        if (!userSnapshot.exists()) {
            return res.status(404).json({ message: 'User not found or no reactions available' });
        }

        const reactions = userSnapshot.val();
        const response = {
            likes: reactions.likes || 0,
            dislikes: reactions.dislikes || 0,
            comments: reactions.comments || []
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('Error fetching reactions:', error);
        res.status(500).json({ message: 'Error fetching reactions' });
    }
});








// Add a referral ID for a user (Update this to calculate referral earnings and bonus)
app.post('/api/add-referral', async (req, res) => {
    const { userId, referralId } = req.body;
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Add the referral ID to the user's referrals array
        const updatedReferrals = userData.referrals || [];
        updatedReferrals.push(referralId);

        // Update referral earnings and referral bonus
        const referralEarnings = userData.referralEarnings || 0;
        const referralEarningsBonus = userData.referralEarningsBonus || 0;

        // Adjust these values based on your referral logic
        const newReferralEarnings = referralEarnings + 200; // For example: 200 UGX per referral
        const newReferralEarningsBonus = referralEarningsBonus + 200; // For example: 200 UGX bonus per referral

        // Update both referralEarnings and referralEarningsBonus in the database
        await admin.database().ref(`users/${userId}`).update({
            referrals: updatedReferrals,
            referralEarnings: Number(newReferralEarnings), // Ensure it is a number
            referralEarningsBonus: Number(newReferralEarningsBonus) // Ensure it is a number
        });

        res.json({ success: true, message: 'Referral added successfully and earnings updated' });
    } catch (error) {
        console.error('Error adding referral:', error);
        res.status(500).json({ message: 'Error adding referral' });
    }
});

// Fetch referral IDs and earnings for a user
app.get('/api/referrals/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = snapshot.val() || { referrals: {}, referralEarnings: 0, referralEarningsBonus: 0 };
        
        // Extract referral data safely (set empty object if no referrals exist)
        const referrals = userData.referrals ? Object.values(userData.referrals) : [];
        const { referralEarnings, referralEarningsBonus } = userData;

        res.json({ 
            referrals, 
            referralEarnings: Number(referralEarnings), // Ensure it is a number
            referralEarningsBonus: Number(referralEarningsBonus) // Ensure it is a number
        });
    } catch (error) {
        console.error('Error fetching referral data:', error);
        res.status(500).json({ message: 'Error fetching referral data' });
    }
});

// Update referral earnings for a user
app.post('/api/update-referral-earnings', async (req, res) => {
    const { userId, newReferralEarnings } = req.body;
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Convert newReferralEarnings to a number before updating
        const earningsValue = Number(newReferralEarnings);
        if (isNaN(earningsValue)) {
            return res.status(400).json({ message: 'Invalid earnings value' });
        }

        // Update referral earnings
        await admin.database().ref(`users/${userId}`).update({
            referralEarnings: earningsValue
        });

        res.json({ success: true, message: 'Referral earnings updated successfully' });
    } catch (error) {
        console.error('Error updating referral earnings:', error);
        res.status(500).json({ message: 'Error updating referral earnings' });
    }
});

// Update referral earnings bonus for a user
app.post('/api/update-referral-bonus', async (req, res) => {
    const { userId, newReferralEarningsBonus } = req.body;
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Convert newReferralEarningsBonus to a number before updating
        const bonusValue = Number(newReferralEarningsBonus);
        if (isNaN(bonusValue)) {
            return res.status(400).json({ message: 'Invalid bonus value' });
        }

        // Update referral earnings bonus
        await admin.database().ref(`users/${userId}`).update({
            referralEarningsBonus: bonusValue
        });

        res.json({ success: true, message: 'Referral earnings bonus updated successfully' });
    } catch (error) {
        console.error('Error updating referral bonus:', error);
        res.status(500).json({ message: 'Error updating referral bonus' });
    }
});


// Update totalGained and totalInvested for a user
app.post('/api/update-totals', async (req, res) => {
    const { userId, totalGained, totalInvested } = req.body;
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update the fields with provided values
        await admin.database().ref(`users/${userId}`).update({
            totalGained: totalGained || userData.totalGained,
            totalInvested: totalInvested || userData.totalInvested
        });

        res.json({ success: true, message: 'Total fields updated successfully' });
    } catch (error) {
        console.error('Error updating total fields:', error);
        res.status(500).json({ message: 'Error updating total fields' });
    }
});

// Fetch totalGained and totalInvested for a user
app.get('/api/fetch-totals/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        const { totalGained, totalInvested } = userData;
        res.json({ totalGained, totalInvested });
    } catch (error) {
        console.error('Error fetching total fields:', error);
        res.status(500).json({ message: 'Error fetching total fields' });
    }
});

// Add your success message handler here
app.post('/api/success', async (req, res) => {
    const successMessage = req.body;

    console.log('Received success message:', successMessage);

    try {
        // Store the success message in your database
        await admin.database().ref('successMessages').push(successMessage);

        // Send a response back to the sender
        res.status(200).json({ status: 'success', message: 'Message received and saved' });
    } catch (error) {
        console.error('Error saving success message:', error);
        res.status(500).json({ message: 'Error saving success message' });
    }
});

// Fetch all success messages
app.get('/api/success-messages', async (req, res) => {
    try {
        const snapshot = await admin.database().ref('successMessages').once('value');
        const successMessages = snapshot.val();

        if (!successMessages) {
            return res.status(404).json({ message: 'No success messages found' });
        }

        // Convert the messages object into an array
        const messagesArray = Object.entries(successMessages).map(([id, message]) => ({
            id,
            amount: message.amount,
            description: message.description,
            api_status: message.jpesaResponse.api_status,
            log_id: message.log_id,
            memo: message.memo,
            msg: message.msg,
            tid: message.tid,
            mobile: message.mobile,
            tx: message.tx
        }));

        res.json(messagesArray);
    } catch (error) {
        console.error('Error fetching success messages:', error);
        res.status(500).json({ message: 'Error fetching success messages' });
    }
});



// Add a transaction for a user
app.post('/api/add-transaction', async (req, res) => {
    const { userId, amount } = req.body;
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        const newTransaction = {
            amount: Number(amount),
            date: Date.now()
        };

        await admin.database().ref(`users/${userId}/transactionHistory`).push(newTransaction);
        res.json({ success: true, message: 'Transaction added successfully' });
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({ message: 'Error adding transaction' });
    }
});


// Fetch the transaction history for a user
app.get('/api/transaction-history/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}/transactionHistory`).once('value');
        const transactionHistory = snapshot.val() || [];
        res.json({ transactionHistory: Object.values(transactionHistory) });
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        res.status(500).json({ message: 'Error fetching transaction history' });
    }
});




// Endpoint to fetch user casino capital
app.get('/user-casino-capital/:userId', async (req, res) => {
    const { userId } = req.params;

    if (!userId) {
        return res.status(400).send('Missing userId');
    }

    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');

        if (!userSnapshot.exists()) {
            return res.status(404).send('User not found');
        }

        const userData = userSnapshot.val();
        const casinoCapital = userData.capital || 0;

        return res.json({
            userId,
            casinoCapital: parseFloat(casinoCapital.toFixed(2)),
        });
    } catch (error) {
        console.error('Error fetching user casino capital:', error);
        return res.status(500).send('Internal server error');
    }
});




// Endpoint to place a bet and play the fruit game
app.post('/play', async (req, res) => {
    const { userId, betAmount } = req.body;

    if (!userId || !betAmount) {
        return res.status(400).send('Missing userId or betAmount');
    }

    const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
    if (!userSnapshot.exists()) {
        return res.status(404).send('User not found');
    }

    const userData = userSnapshot.val();
    const currentCapital = userData.capital;

    if (currentCapital < betAmount) {
        return res.status(400).send('Insufficient capital');
    }

    const casinoDataRef = admin.database().ref('casinoData');
    const casinoSnapshot = await casinoDataRef.once('value');
    let casinoData = casinoSnapshot.val() || {
        nextRound: Math.floor(Math.random() * 30) + 1,
        casinoBalance: 0,
        companyShares: 0,
    };

    let selectedRound = fruitsGroupedByPayout[casinoData.nextRound];
    let basePayout = 0;
    let payoutMultiplier = 0;
    let userPayout = 0;

    const referenceValue = 3000;
    payoutMultiplier = betAmount / referenceValue;

    basePayout = selectedRound.fruits.reduce((acc, fruit) => {
        return acc + (fruit.payout * fruit.quantity * payoutMultiplier);
    }, 0);

    if (basePayout > 0) {
        userPayout = basePayout + betAmount;
    }

    // Calculate projected casino balance BEFORE payout
    let casinoBalance = casinoData.casinoBalance || 0;
    let companyShares = casinoData.companyShares || 0;

    const poolContribution = betAmount * 0.9;
    const companyContribution = betAmount * 0.1;

    let projectedBalance = casinoBalance + poolContribution - userPayout;

    // If payout breaks the minimum pool balance, switch to default round (no payout)
    const MIN_POOL_BALANCE = 1000;
    if (userPayout > 0 && projectedBalance < MIN_POOL_BALANCE) {
        selectedRound = fruitsGroupedByPayout[1]; // no payout round
        basePayout = 0;
        payoutMultiplier = 0;
        userPayout = 0;
        projectedBalance = casinoBalance + poolContribution; // update projection
    }

    let updatedCapital = currentCapital - betAmount + userPayout;
    casinoBalance += poolContribution;
    companyShares += companyContribution;

    if (userPayout > 0) {
        casinoBalance -= userPayout;
    }

    const newNextRound = Math.floor(Math.random() * 30) + 1;

    const capitalInt = Math.floor(updatedCapital);
    const casinoBalanceInt = Math.floor(casinoBalance);
    const companySharesInt = Math.floor(companyShares);

    await admin.database().ref(`users/${userId}`).update({
        casinoRound: casinoData.nextRound,
        capital: capitalInt,
    });

    await Promise.all([
        admin.database().ref('casinoData').update({
            nextRound: newNextRound,
            casinoBalance: casinoBalanceInt,
            companyShares: companySharesInt,
        }),
    ]);

    let roundDetails = selectedRound.fruits.map(fruit => {
        return `${fruit.quantity}x ${fruit.type}`;
    }).join(", ");

    let payoutPerFruit = selectedRound.fruits.map(fruit => {
        let adjusted = payoutMultiplier ? fruit.payout * payoutMultiplier : 0;
        let formatted = adjusted % 1 === 0 ? adjusted.toFixed(0) : adjusted.toFixed(1);
        return `${fruit.type} ${formatted}`;
    }).join(", ");

    return res.json({
        userId,
        betAmount,
        round: casinoData.nextRound,
        roundDetails: roundDetails,
        payoutPerFruit: payoutPerFruit,
        userPayout: Math.floor(userPayout),
        updatedCapital: capitalInt,
    });
});




// API Endpoint for playing the game
app.post('/play-lucky-3', async (req, res) => {
    const { userId, amount, numbers } = req.body;

    // Input validation
    if (!userId || !amount || !Array.isArray(numbers) || numbers.length !== 3) {
        return res.status(400).json({ error: 'Invalid input. Provide userId, amount, and 3 numbers.' });
    }

    try {
        const db = admin.database();
        const userRef = db.ref(`users/${userId}`);
        const userSnapshot = await userRef.once('value');
        const userData = userSnapshot.val();

        if (!userData || typeof userData.capital !== 'number') {
            return res.status(400).json({ error: 'User not found or capital not defined.' });
        }

        if (userData.capital < amount) {
            return res.status(400).json({ error: 'Insufficient balance.' });
        }

        // Deduct the amount from user's capital
        let updatedCapital = userData.capital - amount;

        // Store the amount paid for the lucky game
        const luckyPaid = amount;

        // Allocate portions to pool and share
        const luckyPoolAmount = amount * 0.9;
        const luckyShareAmount = amount * 0.1;

        const luckyRef = db.ref('lucky3');
        const luckySnapshot = await luckyRef.once('value');
        const luckyData = luckySnapshot.val() || {};

        let currentPool = luckyData.luckyPool || 0;
        let currentShare = luckyData.luckyShare || 0;

        // Sequential round (1 to 40 loop)
        let round = luckyData.nextNumber || 1;
        round = (round > 40) ? 1 : round; // Ensure it loops back to 1 after 40
        let drawnNumbers = positionChances[round];
        let matchedNumbers = numbers.filter(n => drawnNumbers.includes(n));

        // Calculate earnings based on matches
        let earnings = 0;
        let message = "You Lose!";
        const matchCount = matchedNumbers.length;

        if (matchCount === 1) {
            earnings = amount * 1.5;
        } else if (matchCount === 2) {
            earnings = amount * 3;
        } else if (matchCount === 3) {
            earnings = amount * 5;
        }

        if (earnings > 0) {
            if (currentPool >= earnings) {
                updatedCapital += earnings;
                currentPool -= earnings;
                message = "You Win!";
            } else {
                // Force loss if pool is insufficient
                message = "You Lose!";
                earnings = 0;

                let tries = 0;
                while (matchedNumbers.length > 0 && tries < 10) {
                    round = (round % 40) + 1;
                    drawnNumbers = positionChances[round];
                    matchedNumbers = numbers.filter(n => drawnNumbers.includes(n));
                    tries++;
                }
            }
        }

        // Update pool and share amounts
        currentPool += luckyPoolAmount;
        currentShare += luckyShareAmount;

        // Set next round (sequentially)
        let nextRound = (round % 40) + 1;

        await luckyRef.update({
            luckyPool: currentPool,
            luckyShare: currentShare,
            nextNumber: nextRound
        });

        // Update user data (capital, round, luckyPaid)
        await userRef.update({
            capital: updatedCapital,
            luckyRound: round,
            luckyPaid: luckyPaid // Only store the latest amount paid
        });

        res.status(200).json({
            round,
            drawnNumbers,
            matchedNumbers,
            earnings,
            message,
            nextNumber: nextRound
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error.' });
    }
});





// Add/Withdraw capital endpoint
app.patch('/api/update-casino-capital', async (req, res) => {
    const { userId, amount, action } = req.body;

    if (!userId || amount === undefined || !action) {
        return res.status(400).json({ message: 'User ID, amount, and action (add or withdraw) are required' });
    }

    try {
        const userRef = db.ref(`users/${userId}`);
        const snapshot = await userRef.once('value');

        if (!snapshot.exists()) {
            return res.status(404).json({ message: 'User not found' });
        }

        const userData = snapshot.val();
        const currentCapital = userData.capital || 0;
        let newCapital;

        if (action === 'add') {
            try {
                // Withdraw from external balance
                const balanceResponse = await axios.patch('https://suppay-a04mnfq64-nexus-int.vercel.app/api/update-balance', {
                    userId,
                    balance: amount,
                    reason: 'withdrawal'
                });

                if (balanceResponse.data.message === 'Insufficient balance for withdrawal') {
                    return res.status(400).json({ message: 'Insufficient balance from main wallet' }); // Updated error message
                }

                newCapital = currentCapital + amount;
                await userRef.update({ capital: newCapital });

                res.json({
                    message: 'Casino capital updated successfully',
                    newBalance: balanceResponse.data.newBalance,
                    newCapital
                });
            } catch (balanceError) {
                return res.status(balanceError.response?.status || 500).json({
                    message: balanceError.response?.data?.message || 'Error updating balance'
                });
            }

        } else if (action === 'withdraw') {
            // Check if there is enough capital to withdraw
            if (currentCapital < amount) {
                return res.status(400).json({ message: 'Insufficient Earnings' });
            }

            newCapital = currentCapital - amount;
            await userRef.update({ capital: newCapital });

            try {
                const balanceResponse = await axios.patch('https://suppay-a04mnfq64-nexus-int.vercel.app/api/update-balance', {
                    userId,
                    balance: amount,
                    reason: 'topup'
                });

                res.json({
                    message: 'Casino capital withdrawn successfully',
                    newBalance: balanceResponse.data.newBalance,
                    newCapital
                });
            } catch (balanceError) {
                return res.status(balanceError.response?.status || 500).json({
                    message: balanceError.response?.data?.message || 'Error updating balance'
                });
            }

        } else {
            return res.status(400).json({ message: 'Invalid action. Only "add" or "withdraw" are allowed.' });
        }
    } catch (error) {
        console.error('Error updating casino capital:', error);
        res.status(500).json({ message: 'Error updating casino capital', error: error.message });
    }
});





// Endpoint to return all countries, currency codes, and country codes
app.get('/api/countries', (req, res) => {
    const countriesData = [
    { "country": "Afghanistan", "currency_code": "AFN", "country_code": "+93", "flag": "🇦🇫", "phone_length": 9 },
    { "country": "Albania", "currency_code": "ALL", "country_code": "+355", "flag": "🇦🇱", "phone_length": 9 },
    { "country": "Algeria", "currency_code": "DZD", "country_code": "+213", "flag": "🇩🇿", "phone_length": 9 },
    { "country": "Andorra", "currency_code": "EUR", "country_code": "+376", "flag": "🇦🇩", "phone_length": 6 },
    { "country": "Angola", "currency_code": "AOA", "country_code": "+244", "flag": "🇦🇴", "phone_length": 9 },
    { "country": "Antigua and Barbuda", "currency_code": "XCD", "country_code": "+1-268", "flag": "🇦🇬", "phone_length": 7 },
    { "country": "Argentina", "currency_code": "ARS", "country_code": "+54", "flag": "🇦🇷", "phone_length": 10 },
    { "country": "Armenia", "currency_code": "AMD", "country_code": "+374", "flag": "🇦🇲", "phone_length": 8 },
    { "country": "Australia", "currency_code": "AUD", "country_code": "+61", "flag": "🇦🇺", "phone_length": 9 },
    { "country": "Austria", "currency_code": "EUR", "country_code": "+43", "flag": "🇦🇹", "phone_length": 10 },
    { "country": "Azerbaijan", "currency_code": "AZN", "country_code": "+994", "flag": "🇦🇿", "phone_length": 9 },
    { "country": "Bahamas", "currency_code": "BSD", "country_code": "+1-242", "flag": "🇧🇸", "phone_length": 7 },
    { "country": "Bahrain", "currency_code": "BHD", "country_code": "+973", "flag": "🇧🇭", "phone_length": 8 },
    { "country": "Bangladesh", "currency_code": "BDT", "country_code": "+880", "flag": "🇧🇩", "phone_length": 11 },
    { "country": "Barbados", "currency_code": "BBD", "country_code": "+1-246", "flag": "🇧🇧", "phone_length": 7 },
    { "country": "Belarus", "currency_code": "BYN", "country_code": "+375", "flag": "🇧🇾", "phone_length": 9 },
    { "country": "Belgium", "currency_code": "EUR", "country_code": "+32", "flag": "🇧🇪", "phone_length": 9 },
    { "country": "Belize", "currency_code": "BZD", "country_code": "+501", "flag": "🇧🇿", "phone_length": 7 },
    { "country": "Benin", "currency_code": "CFA", "country_code": "+229", "flag": "🇧🇯", "phone_length": 8 },
    { "country": "Bhutan", "currency_code": "BTN", "country_code": "+975", "flag": "🇧🇹", "phone_length": 8 },
    { "country": "Bolivia", "currency_code": "BOB", "country_code": "+591", "flag": "🇧🇴", "phone_length": 8 },
    { "country": "Bosnia and Herzegovina", "currency_code": "BAM", "country_code": "+387", "flag": "🇧🇦", "phone_length": 8 },
    { "country": "Botswana", "currency_code": "BWP", "country_code": "+267", "flag": "🇧🇼", "phone_length": 7 },
    { "country": "Brazil", "currency_code": "BRL", "country_code": "+55", "flag": "🇧🇷", "phone_length": 11 },
    { "country": "Brunei", "currency_code": "BND", "country_code": "+673", "flag": "🇧🇳", "phone_length": 7 },
    { "country": "Bulgaria", "currency_code": "BGN", "country_code": "+359", "flag": "🇧🇬", "phone_length": 9 },
    { "country": "Burkina Faso", "currency_code": "CFA", "country_code": "+226", "flag": "🇧🇫", "phone_length": 8 },
    { "country": "Burundi", "currency_code": "BIF", "country_code": "+257", "flag": "🇧🇮", "phone_length": 8 },
    { "country": "Cabo Verde", "currency_code": "CVE", "country_code": "+238", "flag": "🇨🇻", "phone_length": 7 },
    { "country": "Cambodia", "currency_code": "KHR", "country_code": "+855", "flag": "🇰🇭", "phone_length": 9 },
    { "country": "Cameroon", "currency_code": "CFA", "country_code": "+237", "flag": "🇨🇲", "phone_length": 9 },
    { "country": "Canada", "currency_code": "CAD", "country_code": "+1", "flag": "🇨🇦", "phone_length": 10 },
    { "country": "Central African Republic", "currency_code": "XAF", "country_code": "+236", "flag": "🇨🇫", "phone_length": 8 },
    { "country": "Chad", "currency_code": "XAF", "country_code": "+235", "flag": "🇹🇩", "phone_length": 8 },
    { "country": "Chile", "currency_code": "CLP", "country_code": "+56", "flag": "🇨🇱", "phone_length": 9 },
    { "country": "China", "currency_code": "CNY", "country_code": "+86", "flag": "🇨🇳", "phone_length": 11 },
    { "country": "Colombia", "currency_code": "COP", "country_code": "+57", "flag": "🇨🇴", "phone_length": 10 },
    { "country": "Comoros", "currency_code": "COM", "country_code": "+269", "flag": "🇰🇲", "phone_length": 7 },
    { "country": "Congo (Congo-Brazzaville)", "currency_code": "CDF", "country_code": "+242", "flag": "🇨🇬", "phone_length": 9 },
    { "country": "Congo (Democratic Republic)", "currency_code": "CDF", "country_code": "+243", "flag": "🇨🇩", "phone_length": 9 },
    { "country": "Costa Rica", "currency_code": "CRC", "country_code": "+506", "flag": "🇨🇷", "phone_length": 8 },
    { "country": "Croatia", "currency_code": "HRK", "country_code": "+385", "flag": "🇭🇷", "phone_length": 9 },
    { "country": "Cuba", "currency_code": "CUP", "country_code": "+53", "flag": "🇨🇺", "phone_length": 8 },
    { "country": "Cyprus", "currency_code": "CYP", "country_code": "+357", "flag": "🇨🇾", "phone_length": 8 },
    { "country": "Czech Republic", "currency_code": "CZK", "country_code": "+420", "flag": "🇨🇿", "phone_length": 9 },
    { "country": "Denmark", "currency_code": "DKK", "country_code": "+45", "flag": "🇩🇰", "phone_length": 8 },
    { "country": "Djibouti", "currency_code": "DJF", "country_code": "+253", "flag": "🇩🇯", "phone_length": 8 },
    { "country": "Dominica", "currency_code": "XCD", "country_code": "+1-767", "flag": "🇩🇲", "phone_length": 7 },
    { "country": "Dominican Republic", "currency_code": "DOP", "country_code": "+1-809", "flag": "🇩🇴", "phone_length": 10 },
    { "country": "Ecuador", "currency_code": "USD", "country_code": "+593", "flag": "🇪🇨", "phone_length": 9 },
    { "country": "Egypt", "currency_code": "EGP", "country_code": "+20", "flag": "🇪🇬", "phone_length": 10 },
    { "country": "El Salvador", "currency_code": "SVC", "country_code": "+503", "flag": "🇸🇻", "phone_length": 8 },
    { "country": "Equatorial Guinea", "currency_code": "GNF", "country_code": "+240", "flag": "🇬🇶", "phone_length": 9 },
    { "country": "Eritrea", "currency_code": "ERN", "country_code": "+291", "flag": "🇪🇷", "phone_length": 8 },
    { "country": "Estonia", "currency_code": "EUR", "country_code": "+372", "flag": "🇪🇪", "phone_length": 9 },
    { "country": "Eswatini", "currency_code": "SZL", "country_code": "+268", "flag": "🇸🇿", "phone_length": 9 },
    { "country": "Ethiopia", "currency_code": "ETB", "country_code": "+251", "flag": "🇪🇹", "phone_length": 10 },
    { "country": "Fiji", "currency_code": "FJD", "country_code": "+679", "flag": "🇫🇯", "phone_length": 7 },
    
    { "country": "Finland", "currency_code": "EUR", "country_code": "+358", "flag": "🇫🇮", "phone_length": 9 },
    { "country": "France", "currency_code": "EUR", "country_code": "+33", "flag": "🇫🇷", "phone_length": 9 },
    { "country": "Gabon", "currency_code": "GAB", "country_code": "+241", "flag": "🇬🇦", "phone_length": 8 },
    { "country": "Gambia", "currency_code": "GMD", "country_code": "+220", "flag": "🇬🇲", "phone_length": 7 },
    { "country": "Georgia", "currency_code": "GEL", "country_code": "+995", "flag": "🇬🇪", "phone_length": 9 },
    { "country": "Germany", "currency_code": "EUR", "country_code": "+49", "flag": "🇩🇪", "phone_length": 10 },
    { "country": "Ghana", "currency_code": "GHS", "country_code": "+233", "flag": "🇬🇭", "phone_length": 9 },
    { "country": "Greece", "currency_code": "EUR", "country_code": "+30", "flag": "🇬🇷", "phone_length": 10 },
    { "country": "Grenada", "currency_code": "XCD", "country_code": "+1-473", "flag": "🇬🇩", "phone_length": 7 },
    { "country": "Guatemala", "currency_code": "GTQ", "country_code": "+502", "flag": "🇬🇹", "phone_length": 8 },
    { "country": "Guinea", "currency_code": "GNF", "country_code": "+224", "flag": "🇬🇳", "phone_length": 9 },
    { "country": "Guinea-Bissau", "currency_code": "GNF", "country_code": "+245", "flag": "🇬🇼", "phone_length": 8 },
    { "country": "Guyana", "currency_code": "GYD", "country_code": "+592", "flag": "🇬🇾", "phone_length": 7 },
    { "country": "Haiti", "currency_code": "HTG", "country_code": "+509", "flag": "🇭🇹", "phone_length": 8 },
    { "country": "Honduras", "currency_code": "HNL", "country_code": "+504", "flag": "🇭🇳", "phone_length": 8 },
    { "country": "Hungary", "currency_code": "HUF", "country_code": "+36", "flag": "🇭🇺", "phone_length": 9 },
    { "country": "Iceland", "currency_code": "ISK", "country_code": "+354", "flag": "🇮🇸", "phone_length": 7 },
    { "country": "India", "currency_code": "INR", "country_code": "+91", "flag": "🇮🇳", "phone_length": 10 },
    { "country": "Indonesia", "currency_code": "IDR", "country_code": "+62", "flag": "🇮🇩", "phone_length": 10 },
    { "country": "Iran", "currency_code": "IRR", "country_code": "+98", "flag": "🇮🇷", "phone_length": 10 },
    { "country": "Iraq", "currency_code": "IQD", "country_code": "+964", "flag": "🇮🇶", "phone_length": 9 },
    { "country": "Ireland", "currency_code": "EUR", "country_code": "+353", "flag": "🇮🇪", "phone_length": 9 },
    { "country": "Israel", "currency_code": "ILS", "country_code": "+972", "flag": "🇮🇱", "phone_length": 9 },
    { "country": "Italy", "currency_code": "EUR", "country_code": "+39", "flag": "🇮🇹", "phone_length": 10 },
    { "country": "Jamaica", "currency_code": "JMD", "country_code": "+1-876", "flag": "🇯🇲", "phone_length": 7 },
    { "country": "Japan", "currency_code": "JPY", "country_code": "+81", "flag": "🇯🇵", "phone_length": 10 },
    { "country": "Jordan", "currency_code": "JOD", "country_code": "+962", "flag": "🇯🇴", "phone_length": 9 },
    { "country": "Kazakhstan", "currency_code": "KZT", "country_code": "+7", "flag": "🇰🇿", "phone_length": 10 },
    { "country": "Kenya", "currency_code": "KES", "country_code": "+254", "flag": "🇰🇪", "phone_length": 9 },
    { "country": "Kiribati", "currency_code": "AUD", "country_code": "+686", "flag": "🇰🇮", "phone_length": 7 },
    { "country": "Korea (North)", "currency_code": "KPW", "country_code": "+850", "flag": "🇰🇵", "phone_length": 8 },
    { "country": "Korea (South)", "currency_code": "KRW", "country_code": "+82", "flag": "🇰🇷", "phone_length": 10 },
    { "country": "Kuwait", "currency_code": "KWD", "country_code": "+965", "flag": "🇰🇼", "phone_length": 8 },
    { "country": "Kyrgyzstan", "currency_code": "KGS", "country_code": "+996", "flag": "🇰🇬", "phone_length": 9 },
    { "country": "Laos", "currency_code": "LAK", "country_code": "+856", "flag": "🇱🇸", "phone_length": 8 },
    { "country": "Latvia", "currency_code": "EUR", "country_code": "+371", "flag": "🇱🇻", "phone_length": 8 },
    { "country": "Lebanon", "currency_code": "LBP", "country_code": "+961", "flag": "🇱🇧", "phone_length": 8 },
    { "country": "Lesotho", "currency_code": "LSL", "country_code": "+266", "flag": "🇱🇸", "phone_length": 8 },
    { "country": "Liberia", "currency_code": "LRD", "country_code": "+231", "flag": "🇱🇷", "phone_length": 8 },
    { "country": "Libya", "currency_code": "LYD", "country_code": "+218", "flag": "🇱🇾", "phone_length": 9 },
    { "country": "Liechtenstein", "currency_code": "CHF", "country_code": "+423", "flag": "🇱🇮", "phone_length": 8 },
    { "country": "Lithuania", "currency_code": "EUR", "country_code": "+370", "flag": "🇱🇹", "phone_length": 8 },
    { "country": "Luxembourg", "currency_code": "EUR", "country_code": "+352", "flag": "🇱🇺", "phone_length": 9 },
    { "country": "Madagascar", "currency_code": "MGA", "country_code": "+261", "flag": "🇲🇬", "phone_length": 9 },
    { "country": "Malawi", "currency_code": "MWK", "country_code": "+265", "flag": "🇲🇼", "phone_length": 9 },
    { "country": "Malaysia", "currency_code": "MYR", "country_code": "+60", "flag": "🇲🇾", "phone_length": 10 },
    { "country": "Maldives", "currency_code": "MVR", "country_code": "+960", "flag": "🇲🇻", "phone_length": 7 },
    { "country": "Mali", "currency_code": "CFA", "country_code": "+223", "flag": "🇲🇱", "phone_length": 8 },
    { "country": "Malta", "currency_code": "EUR", "country_code": "+356", "flag": "🇲🇹", "phone_length": 8 },
    { "country": "Marshall Islands", "currency_code": "USD", "country_code": "+692", "flag": "🇲🇭", "phone_length": 7 },
    { "country": "Mauritania", "currency_code": "MRU", "country_code": "+222", "flag": "🇲🇷", "phone_length": 9 },
    
    { "country": "Mauritius", "currency_code": "MUR", "country_code": "+230", "flag": "🇲🇺", "phone_length": 8 },
    { "country": "Mexico", "currency_code": "MXN", "country_code": "+52", "flag": "🇲🇽", "phone_length": 10 },
    { "country": "Micronesia", "currency_code": "USD", "country_code": "+691", "flag": "🇫🇲", "phone_length": 7 },
    { "country": "Moldova", "currency_code": "MDL", "country_code": "+373", "flag": "🇲🇩", "phone_length": 8 },
    { "country": "Monaco", "currency_code": "EUR", "country_code": "+377", "flag": "🇲🇨", "phone_length": 8 },
    { "country": "Mongolia", "currency_code": "MNT", "country_code": "+976", "flag": "🇲🇳", "phone_length": 8 },
    { "country": "Montenegro", "currency_code": "EUR", "country_code": "+382", "flag": "🇲🇪", "phone_length": 8 },
    { "country": "Morocco", "currency_code": "MAD", "country_code": "+212", "flag": "🇲🇦", "phone_length": 9 },
    { "country": "Mozambique", "currency_code": "MZN", "country_code": "+258", "flag": "🇲🇿", "phone_length": 9 },
    { "country": "Myanmar", "currency_code": "MMK", "country_code": "+95", "flag": "🇲🇲", "phone_length": 9 },
    { "country": "Namibia", "currency_code": "NAD", "country_code": "+264", "flag": "🇳🇦", "phone_length": 9 },
    { "country": "Nauru", "currency_code": "AUD", "country_code": "+674", "flag": "🇳🇷", "phone_length": 7 },
    { "country": "Nepal", "currency_code": "NPR", "country_code": "+977", "flag": "🇳🇵", "phone_length": 10 },
    { "country": "Netherlands", "currency_code": "EUR", "country_code": "+31", "flag": "🇳🇱", "phone_length": 9 },
    { "country": "New Zealand", "currency_code": "NZD", "country_code": "+64", "flag": "🇳🇿", "phone_length": 9 },
    { "country": "Nicaragua", "currency_code": "NIO", "country_code": "+505", "flag": "🇳🇮", "phone_length": 8 },
    { "country": "Niger", "currency_code": "NGN", "country_code": "+227", "flag": "🇳🇪", "phone_length": 8 },
    { "country": "Nigeria", "currency_code": "NGN", "country_code": "+234", "flag": "🇳🇬", "phone_length": 10 },
    { "country": "North Macedonia", "currency_code": "MKD", "country_code": "+389", "flag": "🇲🇰", "phone_length": 9 },
    { "country": "Norway", "currency_code": "NOK", "country_code": "+47", "flag": "🇳🇴", "phone_length": 8 },
    { "country": "Oman", "currency_code": "OMR", "country_code": "+968", "flag": "🇴🇲", "phone_length": 8 },
    { "country": "Pakistan", "currency_code": "PKR", "country_code": "+92", "flag": "🇵🇰", "phone_length": 10 },
    { "country": "Palau", "currency_code": "USD", "country_code": "+680", "flag": "🇵🇼", "phone_length": 7 },
    { "country": "Panama", "currency_code": "PAB", "country_code": "+507", "flag": "🇵🇦", "phone_length": 8 },
    { "country": "Papua New Guinea", "currency_code": "PGK", "country_code": "+675", "flag": "🇵🇬", "phone_length": 8 },
    { "country": "Paraguay", "currency_code": "PYG", "country_code": "+595", "flag": "🇵🇾", "phone_length": 9 },
    { "country": "Peru", "currency_code": "PEN", "country_code": "+51", "flag": "🇵🇪", "phone_length": 9 },
    { "country": "Philippines", "currency_code": "PHP", "country_code": "+63", "flag": "🇵🇭", "phone_length": 10 },
    { "country": "Poland", "currency_code": "PLN", "country_code": "+48", "flag": "🇵🇱", "phone_length": 9 },
    { "country": "Portugal", "currency_code": "EUR", "country_code": "+351", "flag": "🇵🇹", "phone_length": 9 },
    { "country": "Qatar", "currency_code": "QAR", "country_code": "+974", "flag": "🇶🇦", "phone_length": 8 },
    { "country": "Romania", "currency_code": "RON", "country_code": "+40", "flag": "🇷🇴", "phone_length": 9 },
    { "country": "Russia", "currency_code": "RUB", "country_code": "+7", "flag": "🇷🇺", "phone_length": 10 },
    { "country": "Rwanda", "currency_code": "RWF", "country_code": "+250", "flag": "🇷🇼", "phone_length": 9 },
    { "country": "Saint Kitts and Nevis", "currency_code": "XCD", "country_code": "+1-869", "flag": "🇰🇳", "phone_length": 7 },
    { "country": "Saint Lucia", "currency_code": "XCD", "country_code": "+1-758", "flag": "🇱🇨", "phone_length": 7 },
    { "country": "Saint Vincent and the Grenadines", "currency_code": "XCD", "country_code": "+1-784", "flag": "🇻🇨", "phone_length": 7 },
    { "country": "Samoa", "currency_code": "WST", "country_code": "+685", "flag": "🇼🇸", "phone_length": 7 },
    { "country": "San Marino", "currency_code": "EUR", "country_code": "+378", "flag": "🇸🇲", "phone_length": 9 },
    { "country": "Sao Tome and Principe", "currency_code": "STN", "country_code": "+239", "flag": "🇸🇹", "phone_length": 7 },
    { "country": "Saudi Arabia", "currency_code": "SAR", "country_code": "+966", "flag": "🇸🇦", "phone_length": 9 },
    { "country": "Senegal", "currency_code": "CFA", "country_code": "+221", "flag": "🇸🇳", "phone_length": 9 },
    { "country": "Serbia", "currency_code": "RSD", "country_code": "+381", "flag": "🇷🇸", "phone_length": 9 },
    { "country": "Seychelles", "currency_code": "SCR", "country_code": "+248", "flag": "🇸🇨", "phone_length": 7 },
    { "country": "Sierra Leone", "currency_code": "SLL", "country_code": "+232", "flag": "🇸🇱", "phone_length": 8 },
    { "country": "Singapore", "currency_code": "SGD", "country_code": "+65", "flag": "🇸🇬", "phone_length": 8 },
    { "country": "Slovakia", "currency_code": "EUR", "country_code": "+421", "flag": "🇸🇰", "phone_length": 9 },
    { "country": "Slovenia", "currency_code": "EUR", "country_code": "+386", "flag": "🇸🇮", "phone_length": 8 },
    { "country": "Solomon Islands", "currency_code": "SBD", "country_code": "+677", "flag": "🇸🇧", "phone_length": 7 },
    
    { "country": "Somalia", "currency_code": "SOS", "country_code": "+252", "flag": "🇸🇴", "phone_length": 9 },
    { "country": "South Africa", "currency_code": "ZAR", "country_code": "+27", "flag": "🇿🇦", "phone_length": 10 },
    { "country": "South Korea", "currency_code": "KRW", "country_code": "+82", "flag": "🇰🇷", "phone_length": 9 },
    { "country": "South Sudan", "currency_code": "SSP", "country_code": "+211", "flag": "🇸🇸", "phone_length": 9 },
    { "country": "Spain", "currency_code": "EUR", "country_code": "+34", "flag": "🇪🇸", "phone_length": 9 },
    { "country": "Sri Lanka", "currency_code": "LKR", "country_code": "+94", "flag": "🇱🇰", "phone_length": 10 },
    { "country": "Sudan", "currency_code": "SDG", "country_code": "+249", "flag": "🇸🇩", "phone_length": 9 },
    { "country": "Suriname", "currency_code": "SRD", "country_code": "+597", "flag": "🇸🇷", "phone_length": 8 },
    { "country": "Sweden", "currency_code": "SEK", "country_code": "+46", "flag": "🇸🇪", "phone_length": 10 },
    { "country": "Switzerland", "currency_code": "CHF", "country_code": "+41", "flag": "🇨🇭", "phone_length": 9 },
    { "country": "Syria", "currency_code": "SYP", "country_code": "+963", "flag": "🇸🇾", "phone_length": 9 },
    { "country": "Taiwan", "currency_code": "TWD", "country_code": "+886", "flag": "🇹🇼", "phone_length": 10 },
    { "country": "Tajikistan", "currency_code": "TJS", "country_code": "+992", "flag": "🇹🇯", "phone_length": 9 },
    { "country": "Tanzania", "currency_code": "TZS", "country_code": "+255", "flag": "🇹🇿", "phone_length": 9 },
    { "country": "Thailand", "currency_code": "THB", "country_code": "+66", "flag": "🇹🇭", "phone_length": 9 },
    { "country": "Timor-Leste", "currency_code": "USD", "country_code": "+670", "flag": "🇹🇱", "phone_length": 7 },
    { "country": "Togo", "currency_code": "XOF", "country_code": "+228", "flag": "🇹🇬", "phone_length": 8 },
    { "country": "Tonga", "currency_code": "TOP", "country_code": "+676", "flag": "🇹🇴", "phone_length": 7 },
    { "country": "Trinidad and Tobago", "currency_code": "TTD", "country_code": "+1-868", "flag": "🇹🇹", "phone_length": 7 },
    { "country": "Tunisia", "currency_code": "TND", "country_code": "+216", "flag": "🇹🇳", "phone_length": 8 },
    { "country": "Turkey", "currency_code": "TRY", "country_code": "+90", "flag": "🇹🇷", "phone_length": 10 },
    { "country": "Turkmenistan", "currency_code": "TMT", "country_code": "+993", "flag": "🇹🇲", "phone_length": 9 },
    { "country": "Tuvalu", "currency_code": "AUD", "country_code": "+688", "flag": "🇹🇻", "phone_length": 7 },
    { "country": "Uganda", "currency_code": "UGX", "country_code": "+256", "flag": "🇺🇬", "phone_length": 9 },
    { "country": "Ukraine", "currency_code": "UAH", "country_code": "+380", "flag": "🇺🇦", "phone_length": 9 },
    { "country": "United Arab Emirates", "currency_code": "AED", "country_code": "+971", "flag": "🇦🇪", "phone_length": 9 },
    { "country": "United Kingdom", "currency_code": "GBP", "country_code": "+44", "flag": "🇬🇧", "phone_length": 10 },
    { "country": "United States", "currency_code": "USD", "country_code": "+1", "flag": "🇺🇸", "phone_length": 10 },
    { "country": "Uruguay", "currency_code": "UYU", "country_code": "+598", "flag": "🇺🇾", "phone_length": 8 },
    { "country": "Uzbekistan", "currency_code": "UZS", "country_code": "+998", "flag": "🇺🇿", "phone_length": 9 },
    { "country": "Vanuatu", "currency_code": "VUV", "country_code": "+678", "flag": "🇻🇺", "phone_length": 7 },
    { "country": "Vatican City", "currency_code": "EUR", "country_code": "+379", "flag": "🇻🇦", "phone_length": 9 },
    { "country": "Venezuela", "currency_code": "VES", "country_code": "+58", "flag": "🇻🇪", "phone_length": 10 },
    { "country": "Vietnam", "currency_code": "VND", "country_code": "+84", "flag": "🇻🇳", "phone_length": 10 },
    { "country": "Yemen", "currency_code": "YER", "country_code": "+967", "flag": "🇾🇪", "phone_length": 9 },
    { "country": "Zambia", "currency_code": "ZMW", "country_code": "+260", "flag": "🇿🇲", "phone_length": 9 },
    { "country": "Zimbabwe", "currency_code": "ZWL", "country_code": "+263", "flag": "🇿🇼", "phone_length": 9 }
];

    res.json(countriesData);
});







app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
