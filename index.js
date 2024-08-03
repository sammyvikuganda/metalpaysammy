// Create a new user
app.post('/api/create-user', async (req, res) => {
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
        console.error('Error creating user:', error);
        res.status(500).json({ message: 'Error creating user' });
    }
});
