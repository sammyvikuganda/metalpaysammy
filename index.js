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

// Create a new user with a specified user ID
app.post('/api/create-user', async (req, res) => {
    const { userId } = req.body;
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        if (userSnapshot.exists()) {
            return res.status(400).json({ message: 'User ID already exists' });
        }

        const userData = {
            earningsToday: 0,
            earningsThisWeek: 0,
            earningsThisMonth: 0,
            capital: 10000,
            growingMoney: 0,
            lastUpdated: Date.now(),
            transactionHistory: []
        };

        await admin.database().ref(`users/${userId}`).set(userData);
        res.json({ userId });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
});

// Function to calculate growing money based on the latest capital
async function calculateGrowingMoney(userId) {
    const snapshot = await admin.database().ref(`users/${userId}`).once('value');
    const { capital, growingMoney, lastUpdated } = snapshot.val();
    const currentTime = Date.now();
    const elapsedSeconds = (currentTime - lastUpdated) / 1000;

    if (elapsedSeconds > 0) {
        const interestRatePerSecond = Math.pow(1 + 0.0144, 1 / (24 * 60 * 60)) - 1;
        const interestEarned = capital * Math.pow(1 + interestRatePerSecond, elapsedSeconds) - capital;
        const newGrowingMoney = growingMoney + interestEarned;

        await admin.database().ref(`users/${userId}`).update({
            growingMoney: newGrowingMoney,
            lastUpdated: currentTime
        });

        return newGrowingMoney;
    }

    return growingMoney;
}

// Add a new transaction
app.post('/api/add-transaction', async (req, res) => {
    const { userId, amount, type, description } = req.body;
    console.log('Received transaction:', { userId, amount, type, description }); // Debugging log
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        const newTransaction = {
            amount,
            type,
            description,
            date: Date.now()
        };

        userData.transactionHistory.push(newTransaction);

        await admin.database().ref(`users/${userId}`).update({
            transactionHistory: userData.transactionHistory,
            lastUpdated: Date.now()
        });

        res.json({ success: true, transaction: newTransaction });
    } catch (error) {
        console.error('Error adding transaction:', error.message || error);
        res.status(500).json({ message: 'Error adding transaction', error: error.message || error });
    }
});

// Fetch transaction history
app.get('/api/transaction-history/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}/transactionHistory`).once('value');
        const transactionHistory = snapshot.val() || [];
        res.json({ transactionHistory });
    } catch (error) {
        console.error('Error fetching transaction history:', error);
        res.status(500).json({ message: 'Error fetching transaction history' });
    }
});

// Fetch the updated capital
app.get('/api/earnings/capital/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}`).once('value');
        const user = snapshot.val();
        const capital = user ? user.capital : 0;
        res.json({ capital });
    } catch (error) {
        console.error('Error fetching current capital:', error);
        res.status(500).json({ message: 'Error fetching current capital' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
