const express = require('express');
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
    1: 3,
    3: 0,
    5: 1,
    7: 0,
    9: 4,
    2: 15,
    4: 30,
    6: 50,
    8: 60,
    10: 70,
    12: 0,
    14: 5
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



// Endpoint to fetch all details in the pool data, including user earnings data
app.get('/api/get-pool-data', async (req, res) => {
    try {
        const poolSnapshot = await admin.database().ref('poolData').once('value');
        const poolData = poolSnapshot.val();

        if (!poolData) {
            return res.status(404).json({ message: 'Pool data not found' });
        }

        res.json({
            success: true,
            poolData
        });

    } catch (error) {
        console.error('Error fetching pool data:', error);
        res.status(500).json({ message: 'Error fetching pool data', error: error.message });
    }
});



// Endpoint to Retrieve User Status
app.get('/api/get-user-status', async (req, res) => {
    const { userId } = req.query;  // Get userId from query parameter

    if (!userId) {
        return res.status(400).json({ message: 'UserId is required' });
    }

    try {
        // Fetch user data from Firebase
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Get user information such as capital, position, downgrade losses, paid amount, etc.
        const userStatus = {
            capital: userData.capital || 0,
            position: userData.position || 1,  // Default to 1 if not set
            earnedFromPool: userData.earnedFromPool || 0,
            downgradeLosses: userData.downgradeLosses || 0,
            paidAmount: userData.paidAmount || 0,  // This assumes 'paidAmount' is tracked in user data
            loses: userData.loses || 0,
            chances: userData.chance || 0  // Chance is stored in user data
        };

        return res.json({
            success: true,
            userStatus
        });

    } catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ message: 'Error fetching user status', error: error.message });
    }
});



// Endpoint to Place a Bet
app.post('/api/set-custom-interest-rate', async (req, res) => {
    const { userId, paidAmount } = req.body;

    try {
        // Check if the server is busy
        const serverStatusSnapshot = await admin.database().ref('serverStatus').once('value');
        const serverStatus = serverStatusSnapshot.val() || {};

        if (serverStatus.busy) {
            return res.status(503).json({ message: 'Server is busy, please try again later.' });
        }

        // Set server as busy
        await admin.database().ref('serverStatus').set({ busy: true });

        console.log('Received request for userId:', userId, 'with paidAmount:', paidAmount);

        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (isNaN(paidAmount) || paidAmount <= 0) {
            return res.status(400).json({ message: 'Invalid paid amount' });
        }

        if (userData.capital < paidAmount) {
            // Reset server status to not busy before sending the response
            await admin.database().ref('serverStatus').set({ busy: false });

            return res.status(400).json({ message: 'Insufficient capital' });
        }

        const newCapital = userData.capital - paidAmount;

        const poolSnapshot = await admin.database().ref('poolData').once('value');
        const poolData = poolSnapshot.val() || {};
        let poolBalance = poolData.poolBalance || 0;
        let companyEarnings = poolData.companyEarnings || 0;
        let nextPosition = poolData.nextPosition || 1;

        const companyShare = paidAmount * 0.10;
const poolShare = paidAmount * 0.90;

// Initialize downgradeLosses and updatedLoses if not already defined in userData
let downgradeLosses = isNaN(userData.downgradeLosses) ? 0 : userData.downgradeLosses;
let updatedLoses = isNaN(userData.loses) ? 0 : userData.loses;

// New logic: Compare paid amount with pool balance BEFORE adding 90% to the pool
if (paidAmount >= poolBalance / 2) {
    console.log(`User ${userId} paid an amount equal to or greater than half of the pool balance. Continuing cycle.`);
} else {
    // Downgrade logic for all even positions (2, 4, 6, 8, 10) if paid amount is below half of pool balance
    if (nextPosition % 2 === 0 && paidAmount < poolBalance / 2) {
        console.log(`User ${userId} downgraded from position ${nextPosition} due to low payment.`);
        nextPosition -= 1;  // Downgrade position by 1 (from even positions 2, 4, 6, 8, 10)
        downgradeLosses += 1; // Track the downgrade loss
    }
}

// Check if the user has reached 2 downgrade losses
if (downgradeLosses === 2) {
    // If downgrade losses are 2, assign position 12 or 14 randomly
    const newPosition = Math.random() < 0.5 ? 12 : 14;
    nextPosition = newPosition;
    console.log(`User ${userId} reached 2 downgrade losses. Assigned to position ${nextPosition}.`);
    downgradeLosses = 0;  // Reset downgrade losses after assigning position 12 or 14
}

const userPosition = nextPosition; // Save current position after potential downgrade

// Increment loss counter based on odd/even position
if (nextPosition % 2 !== 0) {
    updatedLoses += 1;
} else {
    updatedLoses = 0;
}

// Trigger jackpot on 5 losses: Any amount paid triggers jackpot once losses reach 5
let userEarnings = 0; // Initialize userEarnings variable before use
if (updatedLoses === 5) {
    userEarnings = poolBalance;
    poolBalance = 0;
    nextPosition = 1;  // Reset position to 1 after user earnings all pool balance
    updatedLoses = 0;
    chance = 100;
    console.log(`User ${userId} has reached 5 losses. Jackpot triggered!`);
} else {
    chance = positionChances[nextPosition] || 0;
    if (chance > 0) {
        // Now, add 90% of the paidAmount to the poolBalance
        poolBalance += poolShare; // Add the 90% of paid amount to pool balance

        // **Calculate User's Earnings after 90% of the paidAmount is added to the pool**
        userEarnings = (poolBalance * chance) / 100; // Earnings based on the updated pool balance
        poolBalance -= userEarnings; // Deduct the earnings from the pool balance
    }

    // Keep the position within 1-10 and increment as per normal flow
    nextPosition = (nextPosition % 10) + 1; // Ensure we stay in the 1-10 range
}

// Add company earnings
companyEarnings += companyShare;

// **Add the earnings directly to the user's capital**
const newCapitalAfterEarnings = newCapital + userEarnings;

await admin.database().ref(`users/${userId}`).update({
    userId,
    paidAmount,
    position: userPosition, // Use the final position (after downgrade if any)
    capital: newCapitalAfterEarnings, // Updated capital after earnings
    loses: updatedLoses,
    downgradeLosses, // Track downgrade losses
    chance
});

// Add user earnings and timestamp to poolData
const userEarningsData = poolData.userEarningsData || [];
userEarningsData.push({
    userId,
    earnedAmount: userEarnings,
    timestamp: Date.now()  // Add timestamp of the earning
});

// Update poolData
await admin.database().ref('poolData').set({
    poolBalance,
    companyEarnings,
    nextPosition,
    userEarningsData  // Add the new data to poolData
});


        // Reset server status to not busy
        await admin.database().ref('serverStatus').set({ busy: false });

        res.json({
            success: true,
            message: `User ${userId} processed.`,
            userEarnings,
            poolBalance,
            companyEarnings
        });

    } catch (error) {
        console.error('Error processing payment:', error);

        // Reset server status to not busy in case of error
        await admin.database().ref('serverStatus').set({ busy: false });

        res.status(500).json({ message: 'Error processing payment', error: error.message });
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

    if (casinoData.casinoBalance >= selectedRound.totalPayout) {
        const referenceValue = 3000;
        payoutMultiplier = betAmount / referenceValue;

        basePayout = selectedRound.fruits.reduce((acc, fruit) => {
            return acc + (fruit.payout * fruit.quantity * payoutMultiplier);
        }, 0);
    } else {
        selectedRound = fruitsGroupedByPayout[1]; // Default round with 0 payout
    }

    // Adjust the user payout based on whether they win or lose
    let userPayout = basePayout;
    if (userPayout > 0) {
        // If user wins, include the bet amount in the payout
        userPayout += betAmount;
    }

    // Capital update logic based on win or loss
    let updatedCapital = currentCapital - betAmount + userPayout;

    let casinoBalance = casinoData.casinoBalance || 0;
    let companyShares = casinoData.companyShares || 0;

    const poolContribution = betAmount * 0.9;
    const companyContribution = betAmount * 0.1;

    casinoBalance += poolContribution;
    companyShares += companyContribution;

    // Deduct the full payout (including bet) from the casino pool
    if (userPayout > 0) {
        casinoBalance -= userPayout;
    }

    const newNextRound = Math.floor(Math.random() * 30) + 1;

    await admin.database().ref(`users/${userId}`).update({
        casinoRound: casinoData.nextRound,
        capital: updatedCapital,
    });

    await Promise.all([
        admin.database().ref('casinoData').update({
            nextRound: newNextRound,
            casinoBalance,
            companyShares,
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
        userPayout: parseFloat(userPayout.toFixed(1)),
        updatedCapital: parseFloat(updatedCapital.toFixed(1)),
    });
});




app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
