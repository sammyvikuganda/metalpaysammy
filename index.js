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
        // Check if userId already exists
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        if (userSnapshot.exists()) {
            return res.status(400).json({ message: 'User ID already exists' });
        }

        // Define user data with initial values including transactionHistory
        const userData = {
            earningsToday: 0,
            earningsThisWeek: 0,
            earningsThisMonth: 0,
            capital: 10000, // Set initial capital to UGX 10,000
            growingMoney: 0, // Initialize growing money
            lastUpdated: Date.now(),
            transactionHistory: [] // Initialize transaction history as an empty array
        };

        // Set user data with the specified userId
        await admin.database().ref(`users/${userId}`).set(userData);
        res.json({ userId });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
});

// In-memory cache for user data
let userCache = {};

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

        // Update the database with the new growing money and last updated time
        await admin.database().ref(`users/${userId}`).update({
            growingMoney: newGrowingMoney,
            lastUpdated: currentTime
        });

        return newGrowingMoney;
    }

    return growingMoney;
}

// Update capital and growing money immediately
app.post('/api/update-capital', async (req, res) => {
    const { userId, newCapital } = req.body;
    try {
        // Calculate new growing money
        const newGrowingMoney = await calculateGrowingMoney(userId);
        const currentTime = Date.now();

        // Update the database with new capital and growing money
        await admin.database().ref(`users/${userId}`).update({
            capital: newCapital,
            growingMoney: newGrowingMoney,
            lastUpdated: currentTime
        });

        // Update in-memory cache
        userCache[userId] = {
            capital: newCapital,
            growingMoney: newGrowingMoney,
            lastUpdated: currentTime
        };

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating capital:', error);
        res.status(500).json({ message: 'Error updating capital' });
    }
});

// Add a new transaction
app.post('/api/add-transaction', async (req, res) => {
    const { userId, amount, type, description } = req.body; // Add necessary transaction details
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        const newTransaction = {
            amount,
            type, // e.g., 'credit' or 'debit'
            description,
            date: Date.now()
        };

        // Update the transaction history
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

// Endpoint to reset growing money to 0
app.post('/api/reset-growing-money', async (req, res) => {
    const { userId } = req.body;
    try {
        // Fetch current user data to retain the capital
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Reset growing money and update lastUpdated
        await admin.database().ref(`users/${userId}`).update({
            growingMoney: 0,
            lastUpdated: Date.now()
        });

        // Update in-memory cache
        userCache[userId] = {
            capital: userData.capital,
            growingMoney: 0,
            lastUpdated: Date.now()
        };

        res.json({ success: true });
    } catch (error) {
        console.error('Error resetting growing money:', error);
        res.status(500).json({ message: 'Error resetting growing money' });
    }
});

// Batch process to update all users' growing money daily at 12:50 PM
cron.schedule('50 12 * * *', async () => {
    try {
        console.log('Updating growing money for all users...');
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
            console.log('Update successful for all users.');
        }
    } catch (error) {
        console.error('Error updating all users\' growing money:', error);
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

// Fetch the updated growing money
app.get('/api/earnings/growing-money/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        // Ensure the growing money is updated before fetching
        const newGrowingMoney = await calculateGrowingMoney(userId);
        res.json({ growingMoney: newGrowingMoney });
    } catch (error) {
        console.error('Error fetching growing money:', error);
        res.status(500).json({ message: 'Error fetching growing money' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
