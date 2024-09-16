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

// Function to calculate and update the main balance
async function updateMainBalance(userId) {
    const userRef = admin.database().ref(`users/${userId}`);
    const snapshot = await userRef.once('value');
    const userData = snapshot.val();

    if (userData) {
        const { mainBalance, lastUpdated } = userData;
        const currentTime = Date.now();
        const elapsedSeconds = (currentTime - lastUpdated) / 1000;

        if (elapsedSeconds > 0) {
            // Calculate new balance based on 1.44% interest rate per 24 hours
            const interestRatePerSecond = Math.pow(1 + 0.0144, 1 / (24 * 60 * 60)) - 1;
            const newMainBalance = mainBalance * Math.pow(1 + interestRatePerSecond, elapsedSeconds);
            await userRef.update({
                mainBalance: newMainBalance,
                lastUpdated: currentTime
            });
        }
    }
}

// Fetch the updated main balance
app.get('/api/earnings/current/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        await updateMainBalance(userId); // Update the main balance before fetching it
        
        const snapshot = await admin.database().ref(`users/${userId}/mainBalance`).once('value');
        const mainBalance = snapshot.val() || 0;
        res.json({ mainBalance });
    } catch (error) {
        console.error('Error fetching current balance:', error);
        res.status(500).json({ message: 'Error fetching current balance' });
    }
});

// Handle transactions and update earnings
app.post('/api/transaction', async (req, res) => {
    const { userId, amount, earningsType, phoneNumber, transactionId } = req.body;
    try {
        const userRef = admin.database().ref(`users/${userId}`);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val() || {};

        const newTransaction = {
            amount,
            timestamp: Date.now(),
            phoneNumber: phoneNumber || "",
            transactionId: transactionId || ""
        };

        // Update earnings values based on earningsType
        let updateData = {};
        switch (earningsType) {
            case 'earningsToday':
                updateData.earningsToday = (userData.earningsToday || 0) + amount;
                break;
            case 'earningsThisWeek':
                updateData.earningsThisWeek = (userData.earningsThisWeek || 0) + amount;
                break;
            case 'earningsThisMonth':
                updateData.earningsThisMonth = (userData.earningsThisMonth || 0) + amount;
                break;
            case 'currentBalance':
                updateData.currentBalance = (userData.currentBalance || 0) + amount;
                break;
            case 'mainBalance':
                updateData.mainBalance = (userData.mainBalance || 0) + amount;
                break;
            default:
                return res.status(400).json({ message: 'Invalid earnings type' });
        }

        await userRef.update(updateData);

        // Add the new transaction to the transaction history
        const transactionsRef = userRef.child('transactionHistory');
        await transactionsRef.push(newTransaction);

        res.json({ message: 'Transaction processed successfully' });
    } catch (error) {
        console.error('Error processing transaction:', error);
        res.status(500).json({ message: 'Error processing transaction' });
    }
});

// Fetch earnings today
app.get('/api/earnings/today/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}/earningsToday`).once('value');
        const earningsToday = snapshot.val() || 0;
        res.json({ earningsToday });
    } catch (error) {
        console.error('Error fetching earnings today:', error);
        res.status(500).json({ message: 'Error fetching earnings today' });
    }
});

// Fetch earnings this week
app.get('/api/earnings/this-week/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}/earningsThisWeek`).once('value');
        const earningsThisWeek = snapshot.val() || 0;
        res.json({ earningsThisWeek });
    } catch (error) {
        console.error('Error fetching earnings this week:', error);
        res.status(500).json({ message: 'Error fetching earnings this week' });
    }
});

// Fetch earnings this month
app.get('/api/earnings/this-month/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}/earningsThisMonth`).once('value');
        const earningsThisMonth = snapshot.val() || 0;
        res.json({ earningsThisMonth });
    } catch (error) {
        console.error('Error fetching earnings this month:', error);
        res.status(500).json({ message: 'Error fetching earnings this month' });
    }
});

// Fetch transaction history based on user ID
app.get('/api/transaction-history/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}/transactionHistory`).once('value');
        const transactionHistory = snapshot.val() || {};
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
