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
            referrals: [],
            reactions: { 
                likes: 0,           // Initialize likes to 0
                dislikes: 0,        // Initialize dislikes to 0
                comments: []        // Initialize comments as an empty array
            }
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





// Create a new advert with updated fields
app.post('/api/adverts', async (req, res) => {
    const { 
        advertiserNotice, 
        price, 
        airtelNumber, 
        mtnNumber, 
        chipperTag, 
        bankAccountNumber, 
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
                bankAccountNumber 
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
                bankAccountNumber 
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




// Endpoint to fetch reactions for a specific user
app.get('/api/reactions/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}/reactions`).once('value');
        
        if (!userSnapshot.exists()) {
            return res.status(404).json({ message: 'User not found or no reactions available' });
        }

        const reactions = userSnapshot.val();
        res.json(reactions);
    } catch (error) {
        console.error('Error fetching reactions:', error);
        res.status(500).json({ message: 'Error fetching reactions' });
    }
});



// Start the server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
