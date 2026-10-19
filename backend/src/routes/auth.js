const router = require('express').Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { sendOtpEmail, sendWelcomeEmail } = require('../services/emailService');
const { otp, OtpError } = require('../services/otpService');
const { getLocationFromIp } = require('../services/geoService');
const { logActivity } = require('../services/logActivity');
const sign = (id) => jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
});
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normEmail = (value) => String(value || '').trim().toLowerCase();
// EMAIL_VERIFICATION_REQUIRED=false switches the signup check off. Use it only while rolling out, so the
// signup page and the API can be deployed in either order without breaking signups in between.
const verificationRequired = () => String(process.env.EMAIL_VERIFICATION_REQUIRED ?? 'true').toLowerCase() !== 'false';

/** Turn an OtpError into a clear, safe HTTP answer. */
function otpFailure(res, err) {
    const plural = (n) => `${n} attempt${n === 1 ? '' : 's'}`;
    const answers = {
        invalid:      [400, `Incorrect code. ${plural(err.attemptsLeft)} left.`],
        expired:      [400, 'That code has expired. Please request a new one.'],
        locked:       [429, 'Too many incorrect attempts. Please request a new code.'],
        not_found:    [400, 'That code is not valid. Please request a new one.'],
        cooldown:     [429, `Please wait ${err.retryAfterSeconds} seconds before requesting another code.`],
        rate_limited: [429, 'Too many codes requested for this email. Please try again later.'],
    };
    const [status, message] = answers[err.code] || [400, 'That code is not valid.'];
    return res.status(status).json({ success: false, code: err.code, message, attemptsLeft: err.attemptsLeft, retryAfterSeconds: err.retryAfterSeconds });
}

/** Signup step 1: email a verification code. */
router.post('/register/request-otp', async (req, res) => {
    try {
        const email = normEmail(req.body.email);
        const name = String(req.body.name || '').trim();
        if (!EMAIL_RE.test(email))
            return res.status(400).json({ success: false, message: 'Enter a valid email address.' });
        if (await User.findOne({ email }))
            return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
        let issued;
        try {
            issued = await otp.issue({ email, purpose: 'register' });
        }
        catch (e) {
            if (e instanceof OtpError) return otpFailure(res, e);
            throw e;
        }
        try {
            await sendOtpEmail({ email, name, code: issued.code, purpose: 'register' });
        }
        catch (emailErr) {
            await otp.discard({ email, purpose: 'register' });          // do not make the person wait out a cooldown for an email that never left
            console.error('[OTP] signup code email failed:', emailErr.message);
            return res.status(502).json({ success: false, message: 'We could not send the email right now. Please try again in a moment.' });
        }
        res.json({ success: true, message: 'Verification code sent.', expiresInSeconds: issued.expiresInSeconds, resendAfterSeconds: otp.constants.RESEND_COOLDOWN_MS / 1000 });
    }
    catch (e) {
        console.error('request-otp error:', e);
        res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
    }
});

/** Signup step 2: check the code; the answer is a token the final signup call must carry. */
router.post('/register/verify-otp', async (req, res) => {
    try {
        const email = normEmail(req.body.email);
        const code = String(req.body.code || '').trim();
        if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code))
            return res.status(400).json({ success: false, message: 'Enter the 6-digit code from your email.' });
        try {
            await otp.verify({ email, purpose: 'register', code });
        }
        catch (e) {
            if (e instanceof OtpError) return otpFailure(res, e);
            throw e;
        }
        res.json({ success: true, verificationToken: otp.issueVerificationToken({ email }) });
    }
    catch (e) {
        console.error('verify-otp error:', e);
        res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
    }
});

router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password, referralCode, verificationToken } = req.body;
        if (!name?.trim())
            return res.status(400).json({ success: false, message: 'Name is required.' });
        if (!email?.trim())
            return res.status(400).json({ success: false, message: 'Email is required.' });
        if (!password)
            return res.status(400).json({ success: false, message: 'Password is required.' });
        if (password.length < 6)
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        if (phone) {
            const cleaned = phone.replace(/[\s\-\(\)]/g, '');
            if (!/^\+?[0-9]{7,15}$/.test(cleaned)) {
                return res.status(400).json({ success: false, message: 'Invalid phone number format.' });
            }
        }
        if (await User.findOne({ email: email.toLowerCase() })) {
            return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
        }
        const mustVerify = verificationRequired();
        if (mustVerify && !otp.checkVerificationToken({ email, token: verificationToken }).ok) {
            return res.status(400).json({ success: false, code: 'email_verification_required', message: 'Please verify your email address first.' });
        }
        let referrerId = null;
        if (referralCode) {
            const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
            if (referrer)
                referrerId = referrer._id;
        }
        const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
        const user = await User.create({
            name: name.trim(),
            email: email.toLowerCase().trim(),
            phone: phone?.trim() || null,
            password,
            trialEndsAt,
            subscriptionStatus: 'trial',
            referredBy: referrerId,
            emailVerifiedAt: mustVerify ? new Date() : null,
        });
        sendWelcomeEmail(user.email, user.name, user.plan).catch(err => console.warn('[Email] Welcome email failed:', err.message));
        getLocationFromIp(req.ip).then(loc => {
            user.signupIp = req.ip;
            user.signupLocation = loc;
            return user.save({ validateBeforeSave: false });
        }).catch(err => console.warn('[Geo] signup location save failed:', err.message));
        logActivity({ type: 'signup', user, ip: req.ip, message: `New signup: ${user.email}`, meta: { plan: user.plan, referral: referralCode || null } });
        res.status(201).json({
            success: true,
            token: sign(user._id),
            user: user.toPublicJSON(),
        });
    }
    catch (e) {
        console.error('Register error:', e);
        res.status(500).json({ success: false, message: e.message });
    }
});
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password required.' });
        }
        const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
        if (!user || !(await user.comparePassword(password))) {
            logActivity({ type: 'login_failed', email: email.toLowerCase(), ip: req.ip, status: 'failed', message: `Failed login attempt for ${email}`, meta: { reason: !user ? 'user_not_found' : 'wrong_password' } });
            return res.status(401).json({ success: false, message: 'Invalid email or password.' });
        }
        if (!user.isActive) {
            return res.status(403).json({ success: false, message: 'Account has been deactivated. Contact support.' });
        }
        user.lastLogin = new Date();
        user.loginCount += 1;
        await user.save({ validateBeforeSave: false });
        logActivity({ type: user.role === 'admin' ? 'admin_login' : 'login', user, ip: req.ip, message: `${user.role === 'admin' ? 'Admin' : 'User'} logged in`, meta: { loginCount: user.loginCount } });
        res.json({ success: true, token: sign(user._id), user: user.toPublicJSON() });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.get('/me', protect, (req, res) => {
    res.json({ success: true, user: req.user.toPublicJSON() });
});
router.put('/profile', protect, async (req, res) => {
    try {
        const { name, phone, password, currentPassword } = req.body;
        if (name)
            req.user.name = name.trim();
        if (phone)
            req.user.phone = phone.trim();
        if (password) {
            if (!currentPassword) {
                return res.status(400).json({ success: false, message: 'Current password required to set new password.' });
            }
            const userWithPw = await User.findById(req.user._id).select('+password');
            if (!(await userWithPw.comparePassword(currentPassword))) {
                return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
            }
            if (password.length < 6) {
                return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
            }
            req.user.password = password;
        }
        await req.user.save();
        if (password) {
            logActivity({ type: 'password_changed', user: req.user, ip: req.ip, message: `Password changed by ${req.user.email}` });
        }
        res.json({ success: true, user: req.user.toPublicJSON() });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
router.post('/change-email', protect, async (req, res) => {
    try {
        const { newEmail, currentPassword } = req.body;
        if (!newEmail?.trim())
            return res.status(400).json({ success: false, message: 'New email is required.' });
        if (!currentPassword)
            return res.status(400).json({ success: false, message: 'Current password is required.' });
        if (!newEmail.includes('@'))
            return res.status(400).json({ success: false, message: 'Invalid email address.' });
        const userWithPw = await User.findById(req.user._id).select('+password');
        if (!(await userWithPw.comparePassword(currentPassword))) {
            return res.status(401).json({ success: false, message: 'Incorrect password.' });
        }
        const existing = await User.findOne({ email: newEmail.toLowerCase().trim() });
        if (existing && existing._id.toString() !== req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'That email is already in use.' });
        }
        req.user.email = newEmail.toLowerCase().trim();
        await req.user.save({ validateBeforeSave: false });
        logActivity({ type: 'email_changed', user: req.user, ip: req.ip, message: `Email changed to ${newEmail}`, meta: { newEmail, role: req.user.role } });
        res.json({ success: true, message: 'Email updated successfully.', user: req.user.toPublicJSON() });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
const FORGOT_GENERIC = { success: true, message: 'If an account exists for that email, a 6-digit code has been sent.', expiresInSeconds: 600, resendAfterSeconds: 60 };

/** Password reset step 1: email a code. The answer is identical whether or not the account exists. */
router.post('/forgot-password', async (req, res) => {
    try {
        const email = normEmail(req.body.email);
        if (!email)
            return res.status(400).json({ success: false, message: 'Email is required.' });
        const user = EMAIL_RE.test(email) ? await User.findOne({ email }) : null;
        if (!user)
            return res.json(FORGOT_GENERIC);
        let issued;
        try {
            issued = await otp.issue({ email, purpose: 'reset' });
        }
        catch (e) {
            // Throttled (too soon / too many). Answer exactly as for any other request: saying "wait" would
            // tell a stranger that this email has an account.
            if (e instanceof OtpError) return res.json(FORGOT_GENERIC);
            throw e;
        }
        try {
            await sendOtpEmail({ email: user.email, name: user.name, code: issued.code, purpose: 'reset' });
        }
        catch (emailErr) {
            await otp.discard({ email, purpose: 'reset' });
            console.error('Password reset code email failed:', emailErr.message);
            return res.status(502).json({ success: false, message: 'We could not send the email right now. Please try again in a moment.' });
        }
        logActivity({ type: 'password_reset_requested', user, ip: req.ip, message: `Password reset requested for ${user.email}` });
        res.json(FORGOT_GENERIC);
    }
    catch (e) {
        console.error('forgot-password error:', e);
        res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
    }
});

/** Password reset step 2: check the code; the answer is a short-lived reset token for /reset-password. */
router.post('/forgot-password/verify-otp', async (req, res) => {
    try {
        const email = normEmail(req.body.email);
        const code = String(req.body.code || '').trim();
        if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code))
            return res.status(400).json({ success: false, message: 'Enter the 6-digit code from your email.' });
        const user = await User.findOne({ email });
        try {
            // No account behaves exactly like "no code was requested", so this cannot be used to probe for accounts.
            if (!user) throw new OtpError('not_found');
            await otp.verify({ email, purpose: 'reset', code });
        }
        catch (e) {
            if (e instanceof OtpError) return otpFailure(res, e);
            throw e;
        }
        const resetToken = user.createPasswordResetToken();
        await user.save({ validateBeforeSave: false });
        res.json({ success: true, resetToken });
    }
    catch (e) {
        console.error('forgot-password verify error:', e);
        res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' });
    }
});
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token)
            return res.status(400).json({ success: false, message: 'Reset token is required.' });
        if (!password)
            return res.status(400).json({ success: false, message: 'New password is required.' });
        if (password.length < 6)
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: new Date() },
        }).select('+passwordResetToken +passwordResetExpires');
        if (!user) {
            return res.status(400).json({
                success: false,
                message: 'Reset link is invalid or has expired. Please request a new one.',
            });
        }
        user.password = password;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();
        logActivity({ type: 'password_reset_completed', user, ip: req.ip, message: `Password reset completed for ${user.email}` });
        res.json({
            success: true,
            message: 'Password reset successfully. You can now log in with your new password.',
            token: sign(user._id),
            user: user.toPublicJSON(),
        });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
module.exports = router;
