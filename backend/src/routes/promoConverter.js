const router = require('express').Router();
const { protect, requirePlan } = require('../middleware/auth');
function americanToDecimal(american) {
    if (american >= 100)
        return (american / 100) + 1;
    return (100 / Math.abs(american)) + 1;
}
const round2 = n => Math.round(n * 100) / 100;
const FREE_USES_FOR_BASIC = 3;
router.post('/calculate', protect, requirePlan('basic', 'gold', 'platinum'), async (req, res) => {
    try {
        // Basic plan gets a limited number of calculations, then has to upgrade.
        // Gold/Platinum never hit this check at all.
        if (req.user.plan === 'basic' && req.user.promoConverterUses >= FREE_USES_FOR_BASIC) {
            return res.status(403).json({
                success: false,
                limitReached: true,
                usesRemaining: 0,
                message: `You've used all ${FREE_USES_FOR_BASIC} free Promo Converter calculations on the Basic plan. Upgrade to Gold or Platinum for unlimited use.`,
            });
        }

        const { promoType, promoAmount, bookOdds, hedgeOdds, bonusConversionRate = 75, } = req.body;
        if (!['free_bet', 'risk_free_bet', 'profit_boost'].includes(promoType))
            return res.status(400).json({ success: false, message: 'promoType must be free_bet, risk_free_bet, or profit_boost.' });
        if (!promoAmount || !bookOdds || !hedgeOdds)
            return res.status(400).json({ success: false, message: 'promoAmount, bookOdds, and hedgeOdds are required.' });
        const X = parseFloat(promoAmount);
        const bookDec = americanToDecimal(parseFloat(bookOdds));
        const hedgeDec = americanToDecimal(parseFloat(hedgeOdds));
        const bcr = Math.min(100, Math.max(0, parseFloat(bonusConversionRate))) / 100;
        if (isNaN(X) || isNaN(bookDec) || isNaN(hedgeDec) || X <= 0)
            return res.status(400).json({ success: false, message: 'Invalid values provided.' });
        let hedgeStake, ifBookWins, ifHedgeWins, extractionRate, note;
        if (promoType === 'free_bet') {
            hedgeStake = X * (bookDec - 1) / hedgeDec;
            ifBookWins = X * (bookDec - 1) - hedgeStake;
            ifHedgeWins = hedgeStake * (hedgeDec - 1);
            extractionRate = (ifBookWins / X) * 100;
            note = 'Free bets only pay out winnings, not the stake — the math accounts for that.';
        }
        else if (promoType === 'risk_free_bet') {
            hedgeStake = X * (bookDec - bcr) / hedgeDec;
            ifBookWins = X * (bookDec - 1) - hedgeStake;
            ifHedgeWins = -X + hedgeStake * (hedgeDec - 1) + (X * bcr);
            extractionRate = (Math.min(ifBookWins, ifHedgeWins) / X) * 100;
            note = `Assumes the refunded bonus bet converts to ${Math.round(bcr * 100)}% cash value once hedged again.`;
        }
        else {
            hedgeStake = (X * bookDec) / hedgeDec;
            ifBookWins = X * (bookDec - 1) - hedgeStake;
            ifHedgeWins = hedgeStake * (hedgeDec - 1) - X;
            extractionRate = (Math.min(ifBookWins, ifHedgeWins) / X) * 100;
            note = 'Boosted odds create extra edge vs. a normal hedge — that edge is what you see captured below.';
        }
        hedgeStake = round2(hedgeStake);
        const guaranteedProfit = round2(Math.min(ifBookWins, ifHedgeWins));

        // Only Basic plan actually consumes a use — Gold/Platinum are unlimited
        // and never touch this counter.
        let usesRemaining = null;
        if (req.user.plan === 'basic') {
            req.user.promoConverterUses = (req.user.promoConverterUses || 0) + 1;
            await req.user.save({ validateBeforeSave: false });
            usesRemaining = Math.max(0, FREE_USES_FOR_BASIC - req.user.promoConverterUses);
        }

        res.json({
            success: true,
            usesRemaining,
            result: {
                promoType,
                promoAmount: X,
                bookOddsAmerican: parseFloat(bookOdds),
                hedgeOddsAmerican: parseFloat(hedgeOdds),
                hedgeStake,
                ifBookWins: round2(ifBookWins),
                ifHedgeWins: round2(ifHedgeWins),
                guaranteedProfit,
                extractionRate: round2(extractionRate),
                isProfitable: guaranteedProfit > 0,
                note,
            },
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
module.exports = router;
