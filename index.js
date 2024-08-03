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
    console.log('Request body:', req.body); // Log the request body

    const { username, email } = req.body;

    try {
        // Create a new user ID
        const newUserRef = admin.database().ref('users').push();

        // User data
        const userData = {
            username,
            email,
            commissionToday: 0,
            commissionThisWeek: 0,
            commissionThisMonth: 0,
            currentCommission: 0,
            transactionHistory: []
        };

        // Save user data
        await newUserRef.set(userData);

        // Return the new user ID
        res.json({ userId: newUserRef.key });
    } catch (error) {
        console.error('Error creating user:', error); // Log the error
        res.status(500).json({ message: 'Error creating user' });
    }
});

// Retrieve all users
app.get('/api/users', async (req, res) => {
    try {
        const usersRef = admin.database().ref('users');
        const snapshot = await usersRef.once('value');
        const users = snapshot.val();
        res.json(users);
    } catch (error) {
        console.error('Error retrieving users:', error); // Log the error
        res.status(500).json({ message: 'Error retrieving users' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
