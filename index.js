const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const cron = require('node-cron');
const axios = require('axios'); // Import axios for making HTTP requests
const app = express();
const PORT = process.env.PORT || 3000;

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
    databaseURL: "https://metal-pay-55c31-default-rtdb.firebaseio.com/",
});

app.use(cors());
app.use(express.json());

// Function to send updated balance to another server
async function sendBalanceUpdate(userId, balance) {
    try {
        const response = await axios.patch('https://suppay-bsh0qtsah-sammyviks-projects.vercel.app/api/update-balance', {
            userId: userId,
            balance: balance
        });
        console.log(`Balance update for user ${userId} successful:`, response.data);
    } catch (error) {
        console.error(`Error sending balance update for user ${userId}:`, error.message);
    }
}

// Function to fetch grown balance from the current server
async function fetchAndSendBalance(userId) {
    try {
        // Fetch growing money from the database
        const snapshot = await admin.database().ref(`users/${userId}`).once('value');
        const user = snapshot.val();

        if (user) {
            const growingMoney = user.growingMoney;

            // Send balance update to the other server
            await sendBalanceUpdate(userId, growingMoney);
        } else {
            console.log(`User ${userId} not found`);
        }
    } catch (error) {
        console.error(`Error fetching balance for user ${userId}:`, error.message);
    }
}

// Cron job to run every two minutes
cron.schedule('*/2 * * * *', async () => {
    try {
        console.log('Running balance update for all users every 2 minutes...');
        const snapshot = await admin.database().ref('users').once('value');
        const users = snapshot.val();

        if (users) {
            for (const userId in users) {
                // Fetch and send the balance for each user
                await fetchAndSendBalance(userId);
            }
        } else {
            console.log('No users found');
        }
    } catch (error) {
        console.error('Error during balance update cron job:', error.message);
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
