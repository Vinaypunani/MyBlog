const express = require('express');
const authController = require('../../controllers/auth.controller');
const { requireAuth } = require('../../middlewares/auth.middleware');
// Hypothetical rate limiters
// const { loginLimiter, mfaLimiter } = require('../../middlewares/rateLimiter.middleware');

const router = express.Router();

// =======================
// Traditional & Security Flow
// =======================
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/logout', requireAuth, authController.logout);
router.post('/refresh', authController.refresh);

// =======================
// OAuth 2.0 Flow
// =======================
router.get('/oauth/google', authController.googleOAuth);
router.get('/oauth/google/callback', authController.googleOAuthCallback);
router.get('/oauth/github', authController.githubOAuth);
router.get('/oauth/github/callback', authController.githubOAuthCallback);

// =======================
// Account Recovery & Verification
// =======================
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/verify-email/:token', authController.verifyEmail);

// =======================
// Session & Device Management
// =======================
router.get('/sessions', requireAuth, authController.getSessions);
router.delete('/sessions/all', requireAuth, authController.deleteAllOtherSessions);
router.delete('/sessions/:id', requireAuth, authController.deleteSession);

// =======================
// MFA Management
// =======================
router.post('/mfa/setup', requireAuth, authController.setupMfa);
router.post('/mfa/verify', requireAuth, authController.verifyMfaSetup);
router.post('/mfa/challenge', authController.mfaChallenge);

module.exports = router;
