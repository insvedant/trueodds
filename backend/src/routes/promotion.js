const router = require('express').Router();
const Promotion = require('../models/Promotion');
const { protect, adminOnly } = require('../middleware/auth');
router.get('/', async (req, res) => {
    try {
        const promo = await Promotion.getSingleton();
        const expired = promo.endsAt && new Date(promo.endsAt) < new Date();
        const isLive = promo.active && !expired;
        res.json({
            success: true,
            active: isLive,
            title: promo.title,
            subtitle: promo.subtitle,
            endsAt: promo.endsAt,
            displayPrices: isLive ? promo.displayPrices : null,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.get('/admin', protect, adminOnly, async (req, res) => {
    try {
        const promo = await Promotion.getSingleton();
        res.json({ success: true, promotion: promo });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
router.put('/', protect, adminOnly, async (req, res) => {
    try {
        const { active, title, subtitle, endsAt, coupons, displayPrices } = req.body;
        const promo = await Promotion.getSingleton();
        if (typeof active === 'boolean')
            promo.active = active;
        if (title !== undefined)
            promo.title = title;
        if (subtitle !== undefined)
            promo.subtitle = subtitle;
        if (endsAt !== undefined)
            promo.endsAt = endsAt ? new Date(endsAt) : null;
        if (coupons && typeof coupons === 'object') {
            const mergeCoupons = (planKey) => ({
                monthly: coupons[planKey]?.monthly ?? promo.coupons[planKey]?.monthly ?? '',
                yearly: coupons[planKey]?.yearly ?? promo.coupons[planKey]?.yearly ?? '',
            });
            promo.coupons = {
                basic: mergeCoupons('basic'),
                gold: mergeCoupons('gold'),
                platinum: mergeCoupons('platinum'),
            };
        }
        if (displayPrices && typeof displayPrices === 'object') {
            const merge = (planKey) => ({
                monthly: displayPrices[planKey]?.monthly ?? promo.displayPrices[planKey]?.monthly ?? 0,
                yearly: displayPrices[planKey]?.yearly ?? promo.displayPrices[planKey]?.yearly ?? 0,
            });
            promo.displayPrices = {
                basic: merge('basic'),
                gold: merge('gold'),
                platinum: merge('platinum'),
            };
        }
        promo.updatedAt = new Date();
        await promo.save();
        res.json({ success: true, promotion: promo });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});
module.exports = router;
