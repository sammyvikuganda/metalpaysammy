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

// Create a new user
app.post('/api/create-user', async (req, res) => {
    const { username, email } = req.body;
    try {
        const newUserRef = admin.database().ref('users').push();
        const userData = {
            username,
            email,
            commissionToday: 0,
            commissionThisWeek: 0,
            commissionThisMonth: 0,
            currentCommission: 0,
            transactionHistory: []  // Initialize as an empty array
        };
        await newUserRef.set(userData);
        res.json({ userId: newUserRef.key });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
});

// Handle transactions and update commissions
app.post('/api/transaction', async (req, res) => {
    const { userId, amount } = req.body;
    try {
        const userRef = admin.database().ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val() || {};

        const newTransaction = {
            amount,
            timestamp: Date.now()
        };

        // Update commission values
        const updatedCommissionToday = (userData.commissionToday || 0) + amount;
        const updatedCommissionThisWeek = (userData.commissionThisWeek || 0) + amount;
        const updatedCommissionThisMonth = (userData.commissionThisMonth || 0) + amount;
        const updatedCurrentCommission = (userData.currentCommission || 0) + amount;

        await userRef.update({
            commissionToday: updatedCommissionToday,
            commissionThisWeek: updatedCommissionThisWeek,
            commissionThisMonth: updatedCommissionThisMonth,
            currentCommission: updatedCurrentCommission,
        });

        // Add the new transaction to the transaction history
        const transactionsRef = userRef.child('transactionHistory');
        await transactionsRef.push(newTransaction);

        res.json({ message: 'Transaction processed successfully' });
    } catch (error) {
        console.error('Error processing transaction:', error);
        res.status(500).json({ message: 'Error processing transaction' });
    }
});

// Fetch commission today
app.get('/api/commission/today/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}/commissionToday`).once('value');
        const commissionToday = snapshot.val() || 0;
        res.json({ commissionToday });
    } catch (error) {
        console.error('Error fetching commission today:', error);
        res.status(500).json({ message: 'Error fetching commission today' });
    }
});

// Fetch commission this week
app.get('/api/commission/this-week/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}/commissionThisWeek`).once('value');
        const commissionThisWeek = snapshot.val() || 0;
        res.json({ commissionThisWeek });
    } catch (error) {
        console.error('Error fetching commission this week:', error);
        res.status(500).json({ message: 'Error fetching commission this week' });
    }
});

// Fetch commission this month
app.get('/api/commission/this-month/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}/commissionThisMonth`).once('value');
        const commissionThisMonth = snapshot.val() || 0;
        res.json({ commissionThisMonth });
    } catch (error) {
        console.error('Error fetching commission this month:', error);
        res.status(500).json({ message: 'Error fetching commission this month' });
    }
});

// Fetch current commission
app.get('/api/commission/current/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}/currentCommission`).once('value');
        const currentCommission = snapshot.val() || 0;
        res.json({ currentCommission });
    } catch (error) {
        console.error('Error fetching current commission:', error);
        res.status(500).json({ message: 'Error fetching current commission' });
    }
});

// Fetch transaction history based on user ID
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

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
