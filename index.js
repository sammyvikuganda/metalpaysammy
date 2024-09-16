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
            earnedBalance: 0, // New field to store earned money
            Capital: 10000, // Set initial Capital to UGX 10,000
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

// Function to calculate and update the earnings (without topping up Capital)
async function updateEarnings(userId) {
    if (!userCache[userId]) {
        const snapshot = await admin.database().ref(`users/${userId}`).once('value');
        userCache[userId] = snapshot.val();
    }

    const { Capital, earnedBalance, lastUpdated } = userCache[userId];
    const currentTime = Date.now();
    const elapsedSeconds = (currentTime - lastUpdated) / 1000;

    if (elapsedSeconds > 0) {
        // Calculate interest based on Capital (without topping up Capital)
        const interestRatePerSecond = Math.pow(1 + 0.0144, 1 / (24 * 60 * 60)) - 1;
        const earnings = Capital * Math.pow(1 + interestRatePerSecond, elapsedSeconds) - Capital;

        // Update earned balance, but leave Capital unchanged
        userCache[userId].earnedBalance = earnedBalance + earnings;
        userCache[userId].lastUpdated = currentTime;

        // Update the database
        await admin.database().ref(`users/${userId}`).update({
            earnedBalance: userCache[userId].earnedBalance,
            lastUpdated: currentTime
        });
    }
}

// Batch process to update all users' earned balances
const updateAllUserEarnings = async () => {
    const snapshot = await admin.database().ref('users').once('value');
    const users = snapshot.val();

    if (users) {
        const updates = {};
        for (const userId in users) {
            const user = users[userId];
            const { Capital, earnedBalance, lastUpdated } = user;
            const currentTime = Date.now();
            const elapsedSeconds = (currentTime - lastUpdated) / 1000;

            if (elapsedSeconds > 0) {
                const interestRatePerSecond = Math.pow(1 + 0.0144, 1 / (24 * 60 * 60)) - 1;
                const earnings = Capital * Math.pow(1 + interestRatePerSecond, elapsedSeconds) - Capital;

                // Prepare batch update: Add earnings to earnedBalance, but don't modify Capital
                updates[`users/${userId}/earnedBalance`] = earnedBalance + earnings;
                updates[`users/${userId}/lastUpdated`] = currentTime;
            }
        }
        // Perform batch update
        await admin.database().ref().update(updates);
    }
};

// Run the earnings update every 12 hours to reduce reads/writes
setInterval(updateAllUserEarnings, 12 * 60 * 60 * 1000); // 12 hours

// Fetch the updated earnings and Capital
app.get('/api/earnings/current/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        await updateEarnings(userId); // Update earnings before fetching it

        const { Capital, earnedBalance } = userCache[userId] || { Capital: 0, earnedBalance: 0 };
        res.json({ Capital, earnedBalance });
    } catch (error) {
        console.error('Error fetching current earnings:', error);
        res.status(500).json({ message: 'Error fetching current earnings' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
