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

// Create a new user
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

// Add a new transaction
app.post('/api/add-transaction', async (req, res) => {
    const { userId, amount, type, description } = req.body;
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
        console.error('Error adding transaction:', error);
        res.status(500).json({ message: 'Error adding transaction' });
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

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
