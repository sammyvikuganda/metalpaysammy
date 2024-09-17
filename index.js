const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
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

// Create a new user (as before)
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
            capital: 10000, // Set initial capital to UGX 10,000
            growingMoney: 0, // Initialize growing money
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

// Function to calculate growing money
async function calculateGrowingMoney(userId) {
    const snapshot = await admin.database().ref(`users/${userId}`).once('value');
    const { capital, growingMoney, lastUpdated } = snapshot.val();
    const currentTime = Date.now();
    const elapsedSeconds = (currentTime - lastUpdated) / 1000;

    if (elapsedSeconds > 0) {
        const interestRatePerSecond = Math.pow(1 + 0.0144, 1 / (24 * 60 * 60)) - 1;
        const interestEarned = capital * Math.pow(1 + interestRatePerSecond, elapsedSeconds) - capital;
        const newGrowingMoney = growingMoney + interestEarned;

        return newGrowingMoney;
    }

    return growingMoney;
}

// Function to update growing money for all users
const updateAllGrowingMoney = async () => {
    const snapshot = await admin.database().ref('users').once('value');
    const users = snapshot.val();

    if (users) {
        const updates = {};
        for (const userId in users) {
            const newGrowingMoney = await calculateGrowingMoney(userId);
            updates[`users/${userId}/growingMoney`] = newGrowingMoney;
            updates[`users/${userId}/lastUpdated`] = Date.now();
        }
        await admin.database().ref().update(updates);
        console.log('Growing money updated for all users at 12:30 PM');
    }
};

// Schedule task to run every day at 12:30 PM
cron.schedule('30 12 * * *', () => {
    console.log('Running daily growing money update at 12:30 PM');
    updateAllGrowingMoney();
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
