const router = require('express').Router();
const crypto = require('crypto');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const { PLAN_META, TRIAL_DAYS, stripe, createSubscriptionWithTrial, cancelSubscription, createSetupIntent, } = require('../services/stripeService');
const { sendSubscriptionConfirmationEmail, sendOwnerNewSubscriberAlert } = require('../services/emailService');
const { getLocationFromIp } = require('../services/geoService');
const { logActivity } = require('../services/logActivity');
router.get('/plans', (req, res) => {
    res.json({
        success: true,
        trialDays: TRIAL_DAYS,
        refundPolicy: '24 hours',
        plans: [
            {
                id: 'basic',
                name: 'Basic',
                price: 15.99,
                trialDays: 7,
                description: '7-day free trial then $15.99/month',
                features: [
                    'Arbitrage finder',
                    '+EV betting tools',
                    '40+ US sportsbooks',
                    'Unlimited bet tracker',
                    'Smart bet alerts (email)',
                    'Line movement history',
                    'Unlimited devices',
                    'AGCO/iGO regulatory updates',
                    'Cancel anytime',
                ],
            },
            {
                id: 'gold',
                name: 'Gold',
                price: 49.99,
                trialDays: 7,
                description: 'Best for consistent edge bettors',
                popular: true,
                features: [
                    'Everything in Basic',
                    'ML predictions & EV scoring',
                    'Live in-play odds',
                    '100+ global sportsbooks',
                    'Sub-second refresh',
                    'Emergency Hedge calculator',
                    'Priority email support',
                    'Unlimited devices',
                    'AGCO/iGO regulatory updates',
                ],
            },
            {
                id: 'platinum',
                name: 'Platinum',
                price: 99.99,
                trialDays: 7,
                description: 'Maximum edge for serious bettors',
                features: [
                    'Everything in Gold',
                    'API access',
                    '1:1 coaching calls',
                    'Sub-second alerts',
                    'Custom line alerts',
                    'Dedicated account manager',
                    'Unlimited devices',
                    'AGCO/iGO regulatory updates',
                ],
            },
        ],
    });
});
router.get('/me', protect, (req, res) => {
    const u = req.user;
    res.json({
        success: true,
        subscription: {
            plan: u.plan,
            status: u.subscriptionStatus,
            trialEndsAt: u.trialEndsAt,
            subscriptionExpiry: u.subscriptionExpiry,
            subscriptionStartDate: u.subscriptionStartDate,
            totalPaid: u.totalPaid,
            hasPaymentMethod: !!u.stripePaymentMethodId,
            stripeCustomerId: u.stripeCustomerId,
            referralCode: u.referralCode,
            referralCount: u.referralCount,
            referralRewards: u.referralRewards,
        },
    });
});
router.post('/create-with-trial', protect, async (req, res) => {
    try {
        const { planId, paymentMethodId, billingPeriod = 'monthly' } = req.body;
        if (!['basic', 'gold', 'platinum'].includes(planId))
            return res.status(400).json({ success: false, message: 'Invalid plan.' });
        if (!paymentMethodId)
            return res.status(400).json({ success: false, message: 'Payment method required.' });
        if (req.user.stripeSubscriptionId)
            return res.status(400).json({ success: false, message: 'Active subscription already exists.' });
        const priceKey = billingPeriod === 'yearly' ? `${planId}_yearly` : planId;
        const result = await createSubscriptionWithTrial({
            name: req.user.name,
            email: req.user.email,
            planId: priceKey,
            paymentMethodId,
        });
        req.user.plan = planId;
        req.user.subscriptionStatus = 'trial';
        req.user.subscriptionStartDate = new Date();
        req.user.trialEndsAt = result.trialEnd;
        req.user.stripeCustomerId = result.customerId;
        req.user.stripeSubscriptionId = result.subscriptionId;
        req.user.stripePaymentMethodId = paymentMethodId;
        if (!req.user.referralCode) {
            req.user.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
        }
        await req.user.save({ validateBeforeSave: false });
        const meta = PLAN_META[planId];
        const price = billingPeriod === 'yearly' ? meta.yearlyTotal : meta.price;
        sendSubscriptionConfirmationEmail(req.user.email, req.user.name, planId, billingPeriod, price)
            .catch(err => console.warn('[Email] Subscription confirmation failed:', err.message));
        sendOwnerNewSubscriberAlert({ name: req.user.name, email: req.user.email, plan: planId, billingPeriod, price })
            .catch(err => console.warn('[Email] Owner subscriber alert failed:', err.message));
        logActivity({ type: 'trial_started', user: req.user, message: `${req.user.name} started a ${meta.name} ${billingPeriod} trial`, meta: { plan: planId, billingPeriod, price } });
        getLocationFromIp(req.ip).then(loc => {
            req.user.subscribeIp = req.ip;
            req.user.subscribeLocation = loc;
            return req.user.save({ validateBeforeSave: false });
        }).catch(err => console.warn('[Geo] subscribe location save failed:', err.message));
        res.json({
            success: true,
            message: `${meta.name} ${billingPeriod} trial started. Card charged $${price} on ${result.trialEnd.toLocaleDateString()}.`,
            trialEndsAt: result.trialEnd,
            user: req.user.toPublicJSON(),
        });
    }
    catch (err) {
        console.error('Stripe subscription error:', err.message);
        if (err.message?.includes('REPLACE_WITH')) {
            const trialEnd = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
            req.user.plan = req.body.planId;
            req.user.subscriptionStatus = 'trial';
            req.user.trialEndsAt = trialEnd;
            if (!req.user.referralCode)
                req.user.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            await req.user.save({ validateBeforeSave: false });
            return res.json({
                success: true,
                message: `[DEV MODE] Trial started.`,
                trialEndsAt: trialEnd,
                devMode: true,
                user: req.user.toPublicJSON(),
            });
        }
        res.status(500).json({ success: false, message: err.message });
    }
});
router.post('/cancel', protect, async (req, res) => {
    try {
        if (req.user.stripeSubscriptionId) {
            await cancelSubscription(req.user.stripeSubscriptionId);
            req.user.stripeSubscriptionId = null;
        }
        req.user.subscriptionStatus = 'cancelled';
        await req.user.save({ validateBeforeSave: false });
        res.json({ success: true, message: 'Subscription cancelled. Access continues until period ends.' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.post('/refund', protect, async (req, res) => {
    try {
        const user = req.user;
        if (!user.subscriptionStartDate)
            return res.status(400).json({ success: false, message: 'No active subscription found.' });
        const hoursSinceStart = (Date.now() - new Date(user.subscriptionStartDate).getTime()) / (1000 * 60 * 60);
        if (hoursSinceStart > 24)
            return res.status(400).json({ success: false, message: 'Refund window has expired. Refunds are only available within 24 hours of subscribing.' });
        if (user.stripeSubscriptionId) {
            await cancelSubscription(user.stripeSubscriptionId);
        }
        if (user.payments?.length > 0 && user.stripeCustomerId) {
            try {
                const invoices = await stripe.invoices.list({ customer: user.stripeCustomerId, limit: 1 });
                if (invoices.data.length > 0 && invoices.data[0].payment_intent) {
                    await stripe.refunds.create({ payment_intent: invoices.data[0].payment_intent });
                }
            }
            catch (refundErr) {
                console.warn('[Refund] Could not issue Stripe refund:', refundErr.message);
            }
        }
        user.plan = 'free';
        user.subscriptionStatus = 'cancelled';
        user.stripeSubscriptionId = null;
        user.subscriptionStartDate = null;
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, message: 'Refund processed. Your account has been downgraded to free.' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.post('/update-card', protect, async (req, res) => {
    try {
        if (!req.user.stripeCustomerId)
            return res.status(400).json({ success: false, message: 'No Stripe customer found.' });
        const setupIntent = await createSetupIntent(req.user.stripeCustomerId);
        res.json({ success: true, clientSecret: setupIntent.client_secret });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/trial-status', protect, (req, res) => {
    const now = new Date();
    const trialEnd = req.user.trialEndsAt ? new Date(req.user.trialEndsAt) : null;
    const daysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))) : 0;
    const isExpired = trialEnd ? now > trialEnd : false;
    const startDate = req.user.subscriptionStartDate ? new Date(req.user.subscriptionStartDate) : null;
    const hoursLeft24h = startDate ? Math.max(0, 24 - (now - startDate) / (1000 * 60 * 60)) : 0;
    res.json({
        success: true,
        inTrial: req.user.subscriptionStatus === 'trial' && !isExpired,
        daysLeft,
        trialEndsAt: trialEnd,
        isExpired,
        chargeAmount: PLAN_META[req.user.plan]?.price || 0,
        plan: req.user.plan,
        refundEligible: hoursLeft24h > 0,
        refundHoursLeft: Math.round(hoursLeft24h),
    });
});
router.get('/referral', protect, async (req, res) => {
    try {
        if (!req.user.referralCode && req.user.plan !== 'free') {
            req.user.referralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
            await req.user.save({ validateBeforeSave: false });
        }
        const referrals = await User.find({ referredBy: req.user._id })
            .select('name createdAt plan subscriptionStatus')
            .sort({ createdAt: -1 })
            .limit(20);
        const payingReferrals = referrals.filter(r => r.plan !== 'free' && r.subscriptionStatus === 'active');
        res.json({
            success: true,
            referralCode: req.user.referralCode || null,
            referralLink: req.user.referralCode ? `https://trueodds.ca/signup?ref=${req.user.referralCode}` : null,
            totalReferrals: referrals.length,
            payingReferrals: payingReferrals.length,
            rewardsEarned: req.user.referralRewards || 0,
            referrals: referrals.map(r => ({
                name: r.name,
                plan: r.plan,
                status: r.subscriptionStatus,
                joined: r.createdAt,
            })),
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.post('/apply-referral', protect, async (req, res) => {
    try {
        const { referralCode } = req.body;
        if (!referralCode)
            return res.status(400).json({ success: false, message: 'Referral code required.' });
        if (req.user.referredBy)
            return res.status(400).json({ success: false, message: 'Referral already applied.' });
        const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
        if (!referrer)
            return res.status(404).json({ success: false, message: 'Invalid referral code.' });
        if (referrer._id.toString() === req.user._id.toString())
            return res.status(400).json({ success: false, message: 'Cannot refer yourself.' });
        req.user.referredBy = referrer._id;
        await req.user.save({ validateBeforeSave: false });
        res.json({ success: true, message: 'Referral applied! Your referrer will earn 1 free month when you subscribe.' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
module.exports = router;
