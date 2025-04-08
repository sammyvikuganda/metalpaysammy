// Endpoint for setting the custom interest rate and handling user payments
app.post('/api/set-custom-interest-rate', async (req, res) => {
    const { userId, paidAmount } = req.body;

    try {
        // Check if the server is busy
        const serverStatusSnapshot = await admin.database().ref('serverStatus').once('value');
        const serverStatus = serverStatusSnapshot.val() || {};

        if (serverStatus.busy) {
            return res.status(503).json({ message: 'Server is busy, please try again later.' });
        }

        // Set server as busy
        await admin.database().ref('serverStatus').set({ busy: true });

        console.log('Received request for userId:', userId, 'with paidAmount:', paidAmount);

        const userSnapshot = await admin.database().ref(`users/${userId}`).once('value');
        const userData = userSnapshot.val();

        if (!userData) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (isNaN(paidAmount) || paidAmount <= 0) {
            return res.status(400).json({ message: 'Invalid paid amount' });
        }

        if (userData.capital < paidAmount) {
            return res.status(400).json({ message: 'Insufficient capital' });
        }

        const newCapital = userData.capital - paidAmount;

        const poolSnapshot = await admin.database().ref('poolData').once('value');
        const poolData = poolSnapshot.val() || {};
        let poolBalance = poolData.poolBalance || 0;
        let companyEarnings = poolData.companyEarnings || 0;
        let nextPosition = poolData.nextPosition || 1;

        const companyShare = paidAmount * 0.10;
        const poolShare = paidAmount * 0.90;

        const initialPoolBalance = poolBalance;  // Capture the initial pool balance

        poolBalance += poolShare;
        companyEarnings += companyShare;

        let userEarnings = 0;
        let updatedLoses = isNaN(userData.loses) ? 0 : userData.loses;
        let chance = 0;

        let downgradeLosses = isNaN(userData.downgradeLosses) ? 0 : userData.downgradeLosses;

        // **New logic: Advance to next position if paidAmount is half or more of the initial pool balance**
        if (paidAmount >= initialPoolBalance / 2) {
            console.log(`User ${userId} paid an amount greater than or equal to half the pool balance.`);

            // Move to the next position sequentially, in order
            nextPosition = (nextPosition % 10) + 1; // Increment and wrap around if necessary (1 -> 2 -> 3 -> ... -> 10 -> 1)
        }

        // Downgrade logic for all even positions (2, 4, 6, 8, 10) if the paid amount is below half of the pool balance
        if (nextPosition % 2 === 0 && paidAmount < poolBalance / 2) {
            console.log(`User ${userId} downgraded from position ${nextPosition} due to low payment.`);
            nextPosition -= 1;  // Downgrade position by 1 (from even positions 2, 4, 6, 8, 10)
            downgradeLosses += 1; // Track the downgrade loss
        }

        // **Changed: Check if the user has reached 2 downgrade losses**
        if (downgradeLosses === 2) {
            // Assign position 12 or 14 if downgrade losses are 2
            const newPosition = Math.random() < 0.5 ? 12 : 14; // Randomly assign position 12 or 14
            nextPosition = newPosition;
            chance = positionChances[nextPosition] || 0;  // Use the chance of the assigned position
            console.log(`User ${userId} reached 2 downgrade losses. Assigned to position ${nextPosition} with chance ${chance}.`);
            downgradeLosses = 0; // Reset downgrade losses after assigning position 12 or 14
        }

        const userPosition = nextPosition; // Save current position after potential downgrade

        if (nextPosition % 2 !== 0) {
            updatedLoses += 1;
        } else {
            updatedLoses = 0;
        }

        // Check if the user has reached 5 losses and paid at least 20000
        if (updatedLoses === 5 && paidAmount >= 20000) {
            userEarnings = poolBalance;
            poolBalance = 0;
            nextPosition = 1;  // Reset position to 1 after user earnings all pool balance
            updatedLoses = 0;
            chance = 100;
        } else {
            chance = positionChances[nextPosition] || 0;
            if (chance > 0) {
                userEarnings = (poolBalance * chance) / 100;
                poolBalance -= userEarnings;
            }

            // Increment position for next round in the normal 1-10 cycle
            nextPosition = (nextPosition % 10) + 1;
        }

        const currentEarnedFromPool = isNaN(userData.earnedFromPool) ? 0 : userData.earnedFromPool;
        const newEarnedFromPool = currentEarnedFromPool + userEarnings;

        await admin.database().ref(`users/${userId}`).update({
            userId,
            paidAmount,
            position: userPosition, // Use the final position (after downgrade if any)
            capital: newCapital,
            earnedFromPool: newEarnedFromPool,
            loses: updatedLoses,
            downgradeLosses, // Track downgrade losses
            chance
        });

        // Add user earnings and timestamp to poolData
        const userEarningsData = poolData.userEarningsData || [];
        userEarningsData.push({
            userId,
            earnedAmount: userEarnings,
            timestamp: Date.now()  // Add timestamp of the earning
        });

        // Update poolData
        await admin.database().ref('poolData').set({
            poolBalance,
            companyEarnings,
            nextPosition,
            userEarningsData  // Add the new data to poolData
        });

        // Reset server status to not busy
        await admin.database().ref('serverStatus').set({ busy: false });

        res.json({
            success: true,
            message: `User ${userId} processed.`,
            userEarnings,
            poolBalance,
            companyEarnings
        });

    } catch (error) {
        console.error('Error processing payment:', error);

        // Reset server status to not busy in case of error
        await admin.database().ref('serverStatus').set({ busy: false });

        res.status(500).json({ message: 'Error processing payment', error: error.message });
    }
});
