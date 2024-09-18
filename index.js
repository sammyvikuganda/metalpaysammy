const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const cron = require('node-cron');
const fetch = require('node-fetch'); // Add this import

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

        // Define user data with initial values
        const userData = {
            earningsToday: 0,
            earningsThisWeek: 0,
            earningsThisMonth: 0,
            capital: 10000, // Set initial capital to UGX 10,000
            growingMoney: 0, // Initialize growing money
            lastUpdated: Date.now(),
            transactionHistory: {}
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

// Fetch the balance from the other server
async function fetchBalanceFromOtherServer(userId) {
    try {
        const response = await fetch(`https://suppay-bsh0qtsah-sammyviks-projects.vercel.app/api/user-balance/${userId}`);
        const data = await response.json();
        
        if (response.ok) {
            return data.balance;
        } else {
            console.error(data.message);
            return null;
        }
    } catch (error) {
        console.error('Error fetching balance:', error.message);
        return null;
    }
}

// Update the balance on the other server
async function updateBalanceOnOtherServer(userId, balance) {
    try {
        const response = await fetch('https://suppay-bsh0qtsah-sammyviks-projects.vercel.app/api/update-balance', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, balance })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Balance updated successfully');
        } else {
            console.error(data.message);
        }
    } catch (error) {
        console.error('Error updating balance:', error.message);
    }
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

// Cron job to fetch growing money and update the other server every 2 minutes
cron.schedule('*/2 * * * *', async () => {
    try {
        console.log('Fetching and updating growing money for all users...');
        const snapshot = await admin.database().ref('users').once('value');
        const users = snapshot.val();

        if (users) {
            for (const userId in users) {
                const newGrowingMoney = await calculateGrowingMoney(userId);
                
                // Update the other server with the new growing money
                await updateBalanceOnOtherServer(userId, newGrowingMoney);
            }
            console.log('Update successful for all users.');
        }
    } catch (error) {
        console.error('Error fetching and updating growing money:', error);
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
