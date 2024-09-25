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
            capital: 10000,
            growingMoney: 0,
            lastUpdated: Date.now(),
            transactionHistory: [], // Initialize transaction history
            referrals: [], // Initialize referrals as an empty array
            referralEarnings: 0, // Initialize referral earnings
        };

        await admin.database().ref(`users/${userId}`).set(userData);
        res.json({ userId });
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
});

// Add a referral ID for a user
app.post('/api/add-referral', async (req, res) => {
    const { userId, referralId } = req.body;
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Add the referral ID to the user's referrals array
        const updatedReferrals = userData.referrals || [];
        updatedReferrals.push(referralId);

        await admin.database().ref(`users/${userId}`).update({
            referrals: updatedReferrals
        });

        res.json({ success: true, message: 'Referral added successfully' });
    } catch (error) {
        console.error('Error adding referral:', error);
        res.status(500).json({ message: 'Error adding referral' });
    }
});

// Fetch referral IDs for a user
app.get('/api/referrals/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}/referrals`).once('value');
        const referrals = snapshot.val() || [];
        res.json({ referrals: Object.values(referrals) });
    } catch (error) {
        console.error('Error fetching referral IDs:', error);
        res.status(500).json({ message: 'Error fetching referral IDs' });
    }
});

// Fetch referral earnings for a user
app.get('/api/referral-earnings/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}/referralEarnings`).once('value');
        const referralEarnings = snapshot.val() || 0;
        res.json({ referralEarnings });
    } catch (error) {
        console.error('Error fetching referral earnings:', error);
        res.status(500).json({ message: 'Error fetching referral earnings' });
    }
});

// Update referral earnings for a user
app.post('/api/update-referral-earnings', async (req, res) => {
    const { userId, earnings } = req.body;
    try {
        await admin.database().ref(`users/${userId}`).update({
            referralEarnings: earnings
        });
        res.json({ success: true, message: 'Referral earnings updated successfully' });
    } catch (error) {
        console.error('Error updating referral earnings:', error);
        res.status(500).json({ message: 'Error updating referral earnings' });
    }
});

// Count active referrals for a user
app.get('/api/count-active-referrals/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const snapshot = await admin.database().ref(`users/${userId}/referrals`).once('value');
        const referrals = snapshot.val() || [];
        const activeReferralsCount = referrals.length;
        res.json({ activeReferralsCount });
    } catch (error) {
        console.error('Error counting active referrals:', error);
        res.status(500).json({ message: 'Error counting active referrals' });
    }
});

// Add a transaction for a user
app.post('/api/add-transaction', async (req, res) => {
    const { userId, amount } = req.body;
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        const newTransaction = {
            amount: Number(amount),
            date: Date.now()
        };

        await admin.database().ref(`users/${userId}/transactionHistory`).push(newTransaction);
        res.json({ success: true, message: 'Transaction added successfully' });
    } catch (error) {
        console.error('Error adding transaction:', error);
        res.status(500).json({ message: 'Error adding transaction' });
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
        const newGrowingMoney = await calculateGrowingMoney(userId);
        const currentTime = Date.now();

        await admin.database().ref(`users/${userId}`).update({
            capital: newCapital,
            growingMoney: newGrowingMoney,
            lastUpdated: currentTime
        });

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

// Endpoint to reset growing money to 0
app.post('/api/reset-growing-money', async (req, res) => {
    const { userId } = req.body;
    try {
        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        await admin.database().ref(`users/${userId}`).update({
            growingMoney: 0,
            lastUpdated: Date.now()
        });

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
        console.error('Error updating growing money for all users:', error);
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
