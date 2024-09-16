const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
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
app.use(express.static(path.join(__dirname, 'public')));

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
            capital: 10000, // Set initial capital to UGX 10,000
            growingMoney: 0, // Initialize growing money
            lastUpdated: Date.now(),
            transactionHistory: {}
        };
        await newUserRef.set(userData);
        res.json({ userId: newUserRef.key });

        // Notify all clients about the new user
        broadcast('userCreated', { userId: newUserRef.key });

    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
});

// In-memory cache for user data
let userCache = {};

// WebSocket server setup
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Broadcast function to send messages to all connected clients
function broadcast(event, data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ event, data }));
        }
    });
}

// Function to calculate growing money based on capital
async function calculateGrowingMoney(userId) {
    if (!userCache[userId]) {
        const snapshot = await admin.database().ref(`users/${userId}`).once('value');
        userCache[userId] = snapshot.val();
    }
    
    const { capital, growingMoney, lastUpdated } = userCache[userId];
    const currentTime = Date.now();
    const elapsedSeconds = (currentTime - lastUpdated) / 1000;

    if (elapsedSeconds > 0) {
        const interestRatePerSecond = Math.pow(1 + 0.0144, 1 / (24 * 60 * 60)) - 1;
        const interestEarned = capital * Math.pow(1 + interestRatePerSecond, elapsedSeconds) - capital;
        const newGrowingMoney = growingMoney + interestEarned;

        return newGrowingMoney;
    }

    return growingMoney;
}

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
        const growingMoney = await calculateGrowingMoney(userId);
        res.json({ growingMoney });
    } catch (error) {
        console.error('Error fetching growing money:', error);
        res.status(500).json({ message: 'Error fetching growing money' });
    }
});

// Batch process to update all users' growing money
const updateAllGrowingMoney = async () => {
    const snapshot = await admin.database().ref('users').once('value');
    const users = snapshot.val();

    if (users) {
        const updates = {};
        for (const userId in users) {
            const user = users[userId];
            const newGrowingMoney = await calculateGrowingMoney(userId);

            updates[`users/${userId}/growingMoney`] = newGrowingMoney;
            updates[`users/${userId}/lastUpdated`] = Date.now();
        }
        await admin.database().ref().update(updates);
    }
};

setInterval(updateAllGrowingMoney, 12 * 60 * 60 * 1000); // 12 hours

// Serve the dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
