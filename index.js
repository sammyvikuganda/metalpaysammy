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
    databaseURL: "https://metal-pay-55c31-default-rtdb.firebaseio.com",
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

// Update commission values
app.post('/api/update-commission', async (req, res) => {
    const { userId, commissionToday, commissionThisWeek, commissionThisMonth, currentCommission } = req.body;
    try {
        const userRef = admin.database().ref(`users/${userId}`);
        await userRef.update({
            commissionToday,
            commissionThisWeek,
            commissionThisMonth,
            currentCommission
        });
        res.json({ message: 'Commission updated successfully' });
    } catch (error) {
        console.error('Error updating commission:', error);
        res.status(500).json({ message: 'Error updating commission' });
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

// Fetch commission details based on user ID
app.get('/api/commission-today/:userId', async (req, res) => {
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

app.get('/api/commission-this-week/:userId', async (req, res) => {
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

app.get('/api/commission-this-month/:userId', async (req, res) => {
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

app.get('/api/current-commission/:userId', async (req, res) => {
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

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
