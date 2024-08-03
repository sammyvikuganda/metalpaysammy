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
    databaseURL: "https://your-database-name.firebaseio.com",
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
            transactionHistory: []
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
        await userRef.update({
            commissionToday: (userData.commissionToday || 0) + amount,
            commissionThisWeek: (userData.commissionThisWeek || 0) + amount,
            commissionThisMonth: (userData.commissionThisMonth || 0) + amount,
            currentCommission: (userData.currentCommission || 0) + amount,
            transactionHistory: [...(userData.transactionHistory || []), newTransaction],
        });
        res.json({ message: 'Transaction processed successfully' });
    } catch (error) {
        console.error('Error processing transaction:', error);
        res.status(500).json({ message: 'Error processing transaction' });
    }
});

// Fetch commission values
app.get('/api/commission/:type/:userId', async (req, res) => {
    const { type, userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = snapshot.val() || {};
        res.json({ [`${type}Commission`]: userData[`commission${capitalizeFirstLetter(type)}`] || 0 });
    } catch (error) {
        console.error(`Error fetching commission ${type}:`, error);
        res.status(500).json({ message: `Error fetching commission ${type}` });
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
