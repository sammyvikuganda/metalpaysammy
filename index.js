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

// Define routes here (create-user, transaction, etc.)

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
