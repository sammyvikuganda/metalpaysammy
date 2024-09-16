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

// Create a new user with renamed fields
app.post('/api/create-user', async (req, res) => {
    const { username, email } = req.body;
    try {
        const newUserRef = admin.database().ref('users').push();
        const userData = {
            username,
            email,
            earningsToday: 0,
            earningsThisWeek: 0,
            earningsThisMonth: 0,
            currentBalance: 0,
            mainBalance: 10000, // Set initial main balance to UGX 10,000
            lastUpdated: Date.now(),
            transactionHistory: {}
        };
        await newUserRef.set(userData);
        res.json({ userId: newUserRef.key });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
});

// In-memory cache for user data
let userCache = {};

// Function to calculate and update the main balance
async function updateMainBalance(userId) {
    if (!userCache[userId]) {
        const snapshot = await admin.database().ref(`users/${userId}`).once('value');
        userCache[userId] = snapshot.val();
    }
    
    const { mainBalance, lastUpdated } = userCache[userId];
    const currentTime = Date.now();
    const elapsedSeconds = (currentTime - lastUpdated) / 1000;

    if (elapsedSeconds > 0) {
        // Calculate new balance based on 1.44% interest rate per 24 hours
        const interestRatePerSecond = Math.pow(1 + 0.0144, 1 / (24 * 60 * 60)) - 1;
        const newMainBalance = mainBalance * Math.pow(1 + interestRatePerSecond, elapsedSeconds);

        // Update the in-memory cache
        userCache[userId].mainBalance = newMainBalance;
        userCache[userId].lastUpdated = currentTime;

        // Update the database
        await admin.database().ref(`users/${userId}`).update({
            mainBalance: newMainBalance,
            lastUpdated: currentTime
        });
    }
}

// Batch process to update all users' balances
const updateAllUserBalances = async () => {
    const snapshot = await admin.database().ref('users').once('value');
    const users = snapshot.val();

    if (users) {
        const updates = {};
        for (const userId in users) {
            const user = users[userId];
            const { mainBalance, lastUpdated } = user;
            const currentTime = Date.now();
            const elapsedSeconds = (currentTime - lastUpdated) / 1000;

            if (elapsedSeconds > 0) {
                const interestRatePerSecond = Math.pow(1 + 0.0144, 1 / (24 * 60 * 60)) - 1;
                const newMainBalance = mainBalance * Math.pow(1 + interestRatePerSecond, elapsedSeconds);

                // Prepare batch update
                updates[`users/${userId}/mainBalance`] = newMainBalance;
                updates[`users/${userId}/lastUpdated`] = currentTime;
            }
        }
        // Perform batch update
        await admin.database().ref().update(updates);
    }
};

// Run the balance update every 12 hours to reduce reads/writes
setInterval(updateAllUserBalances, 12 * 60 * 60 * 1000); // 12 hours

// Fetch the updated main balance
app.get('/api/earnings/current/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        await updateMainBalance(userId); // Update the main balance before fetching it

        const mainBalance = userCache[userId] ? userCache[userId].mainBalance : 0;
        res.json({ mainBalance });
    } catch (error) {
        console.error('Error fetching current balance:', error);
        res.status(500).json({ message: 'Error fetching current balance' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
