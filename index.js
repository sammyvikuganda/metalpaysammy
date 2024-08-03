const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const cron = require('node-cron');
require('dotenv').config(); // Load environment variables from .env file

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

// Routes
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

app.post('/api/transaction', async (req, res) => {
    const { userId, amount } = req.body;
    try {
        const userRef = admin.database().ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val() || {};
        const newTransaction = { amount, timestamp: Date.now() };
        const updatedCommissionToday = (userData.commissionToday || 0) + amount;
        const updatedCommissionThisWeek = (userData.commissionThisWeek || 0) + amount;
        const updatedCommissionThisMonth = (userData.commissionThisMonth || 0) + amount;
        const updatedCurrentCommission = (userData.currentCommission || 0) + amount;
        await userRef.update({
            commissionToday: updatedCommissionToday,
            commissionThisWeek: updatedCommissionThisWeek,
            commissionThisMonth: updatedCommissionThisMonth,
            currentCommission: updatedCurrentCommission,
            transactionHistory: [...(userData.transactionHistory || []), newTransaction],
        });
        res.json({ message: 'Transaction processed successfully' });
    } catch (error) {
        console.error('Error processing transaction:', error);
        res.status(500).json({ message: 'Error processing transaction' });
    }
});

// Scheduled tasks
cron.schedule('0 0 * * *', async () => {
    console.log('Running daily commission reset job...');
    try {
        const usersRef = admin.database().ref('users');
        const snapshot = await usersRef.once('value');
        const users = snapshot.val();
        if (users) {
            for (const userId in users) {
                const user = users[userId];
                const { commissionToday, commissionThisWeek, commissionThisMonth } = user;
                await usersRef.child(userId).update({
                    commissionToday: 0,
                    commissionThisWeek: (commissionThisWeek || 0) + (commissionToday || 0),
                    commissionThisMonth: (commissionThisMonth || 0) + (commissionToday || 0),
                });
            }
        }
        console.log('Daily commission reset completed.');
    } catch (error) {
        console.error('Error resetting daily commission:', error);
    }
});

cron.schedule('0 0 * * 0', async () => {
    console.log('Running weekly commission reset job...');
    try {
        const usersRef = admin.database().ref('users');
        const snapshot = await usersRef.once('value');
        const users = snapshot.val();
        if (users) {
            for (const userId in users) {
                await usersRef.child(userId).update({
                    commissionThisWeek: 0,
                });
            }
        }
        console.log('Weekly commission reset completed.');
    } catch (error) {
        console.error('Error resetting weekly commission:', error);
    }
});

cron.schedule('0 0 1 * *', async () => {
    console.log('Running monthly commission reset job...');
    try {
        const usersRef = admin.database().ref('users');
        const snapshot = await usersRef.once('value');
        const users = snapshot.val();
        if (users) {
            for (const userId in users) {
                await usersRef.child(userId).update({
                    commissionThisMonth: 0,
                    currentCommission: 0,
                    transactionHistory: [],
                });
            }
        }
        console.log('Monthly commission reset completed.');
    } catch (error) {
        console.error('Error resetting monthly commission:', error);
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

// Fetch today's commission based on user ID
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

// Fetch this week's commission based on user ID
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

// Fetch this month's commission based on user ID
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

// Fetch current commission based on user ID
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

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

