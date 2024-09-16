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

        // Debugging log
        console.log(`Updating user ${userId}: mainBalance=${mainBalance}, lastUpdated=${lastUpdated}, currentTime=${currentTime}, elapsedSeconds=${elapsedSeconds}`);

        if (elapsedSeconds > 0) {
            // Calculate new balance based on 1.44% interest rate per 24 hours
            const interestRatePerSecond = Math.pow(1 + 0.0144, 1 / (24 * 60 * 60)) - 1;
            const newMainBalance = mainBalance * Math.pow(1 + interestRatePerSecond, elapsedSeconds);

            // Debugging log
            console.log(`New calculated main balance: ${newMainBalance}`);

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

// Other routes for transactions, earnings, and history...

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
