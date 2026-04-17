/**
 * Auth Controller
 * Implements the endpoint logic for Authentication, Sessions, Recovery, and OAuth flows.
 */

const User = require('../models/user.model');
const Session = require('../models/session.model');
const RefreshToken = require('../models/refreshToken.model');
const { hashPassword, comparePassword, generateAccessToken, generateRefreshTokenString, hashToken, encryptSymmetric, decryptSymmetric } = require('../utils/auth.utils');
const crypto = require('crypto');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');

// Utility for setting cookies
const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax', 
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });
};

// =======================
// Traditional Flow
// =======================

exports.register = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    
    // Stub basic check, would normally be handled by Zod in a middleware
    if (!email || !username || !password) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }

    const existingUser = await User.findOne({ 
      $or: [{ email: email.toLowerCase() }, { username }] 
    });

    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User already exists' });
    }

    const passwordHash = await hashPassword(password);
    const newUser = await User.create({
      email: email.toLowerCase(),
      username,
      passwordHash
    });

    // Optionally generate verification token and send email...
    res.status(201).json({ success: true, message: 'User registered successfully. Please verify your email.' });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash +mfaEnabled');
    if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });

    // MFA Challenge Check
    if (user.mfaEnabled) {
      return res.status(200).json({ success: true, mfaRequired: true, userId: user._id });
    }

    // Generate Tokens
    const accessToken = generateAccessToken(user);
    const refreshTokenString = generateRefreshTokenString();
    
    // Hash IP for session
    const ipHash = crypto.createHash('sha256').update(req.ip || 'unknown').digest('hex');
    const sessionId = crypto.randomUUID();

    await Session.create({
      userId: user._id,
      sessionId,
      ipHash,
      userAgent: req.headers['user-agent'],
      location: 'unknown', 
      lastActiveAt: new Date()
    });

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(refreshTokenString),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      deviceInfo: req.headers['user-agent']
    });

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save();

    setRefreshTokenCookie(res, refreshTokenString);

    res.status(200).json({ 
      success: true, 
      accessToken,
      user: { id: user._id, username: user.username, role: user.role }
    });
  } catch (error) {
    next(error);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (refreshToken) {
      await RefreshToken.findOneAndUpdate(
        { tokenHash: hashToken(refreshToken) },
        { revoked: true }
      );
    }
    
    // Blacklist access token ideally handled via redis logic here...
    // res.clearCookie('refreshToken');
    res.cookie('refreshToken', '', { httpOnly: true, expires: new Date(0) });
    
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.cookies;
    if (!refreshToken) return res.status(401).json({ success: false, message: 'No refresh token provided' });

    const tokenHash = hashToken(refreshToken);
    const storedToken = await RefreshToken.findOne({ tokenHash }).populate('userId');

    if (!storedToken) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token' });
    }

    // Reuse detection
    if (storedToken.revoked) {
      // Security breach! Revoke ALL tokens and sessions for this user
      await RefreshToken.updateMany({ userId: storedToken.userId._id }, { revoked: true });
      await Session.deleteMany({ userId: storedToken.userId._id });
      return res.status(403).json({ success: false, message: 'Token reuse detected. All sessions revoked.' });
    }

    // Revoke the old token (Rotation)
    storedToken.revoked = true;
    await storedToken.save();

    if (new Date() > storedToken.expiresAt) {
      return res.status(401).json({ success: false, message: 'Refresh token expired' });
    }

    // Issue new tokens
    const user = storedToken.userId;
    const accessToken = generateAccessToken(user);
    const newRefreshTokenString = generateRefreshTokenString();

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(newRefreshTokenString),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
      deviceInfo: req.headers['user-agent']
    });

    setRefreshTokenCookie(res, newRefreshTokenString);
    res.status(200).json({ success: true, accessToken });
  } catch (error) {
    next(error);
  }
};

// =======================
// OAuth Handlers
// =======================
exports.googleOAuth = (req, res, next) => {
  const redirectUri = `${process.env.API_BASE_URL || 'http://localhost:5000'}/v1/auth/oauth/google/callback`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email profile`;
  res.redirect(url);
};

exports.googleOAuthCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ success: false, message: 'OAuth code missing' });

    const redirectUri = `${process.env.API_BASE_URL || 'http://localhost:5000'}/v1/auth/oauth/google/callback`;
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) return res.status(400).json({ success: false, message: 'OAuth exchange failed' });

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const googleUser = await userRes.json();

    let user = await User.findOne({ email: googleUser.email.toLowerCase() });
    if (!user) {
      const passwordHash = await hashPassword(crypto.randomBytes(20).toString('hex'));
      user = await User.create({
        email: googleUser.email.toLowerCase(),
        username: `user_${crypto.randomBytes(4).toString('hex')}`,
        passwordHash,
        profile: { displayName: googleUser.name, avatar: googleUser.picture },
        authProviders: [{ provider: 'google', providerId: googleUser.id }],
        isVerified: true
      });
    } else {
      if (!user.authProviders.some(p => p.provider === 'google')) {
        user.authProviders.push({ provider: 'google', providerId: googleUser.id });
        await user.save();
      }
    }

    const accessToken = generateAccessToken(user);
    const refreshTokenString = generateRefreshTokenString();
    
    await Session.create({
      userId: user._id,
      sessionId: crypto.randomUUID(),
      ipHash: crypto.createHash('sha256').update(req.ip || 'unknown').digest('hex'),
      userAgent: req.headers['user-agent'],
      location: 'unknown', 
      lastActiveAt: new Date()
    });

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(refreshTokenString),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    user.lastLoginAt = new Date();
    await user.save();

    setRefreshTokenCookie(res, refreshTokenString);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/success?token=${accessToken}`);
  } catch (error) { next(error); }
};

exports.githubOAuth = (req, res, next) => {
  const redirectUri = `${process.env.API_BASE_URL || 'http://localhost:5000'}/v1/auth/oauth/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=user:email`;
  res.redirect(url);
};

exports.githubOAuthCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) return res.status(400).json({ success: false, message: 'OAuth code missing' });

    const redirectUri = `${process.env.API_BASE_URL || 'http://localhost:5000'}/v1/auth/oauth/github/callback`;
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        redirect_uri: redirectUri
      })
    });
    const tokenData = await tokenRes.json();
    if (tokenData.error) return res.status(400).json({ success: false, message: 'OAuth exchange failed' });

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const githubUser = await userRes.json();

    const emailsRes = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });
    const githubEmails = await emailsRes.json();
    const primaryEmailObj = githubEmails.find(e => e.primary) || githubEmails[0];
    if (!primaryEmailObj) return res.status(400).json({ success: false, message: 'No email found in GitHub profile' });
    const emailStr = primaryEmailObj.email.toLowerCase();

    let user = await User.findOne({ email: emailStr });
    if (!user) {
      const passwordHash = await hashPassword(crypto.randomBytes(20).toString('hex'));
      user = await User.create({
        email: emailStr,
        username: githubUser.login,
        passwordHash,
        profile: { displayName: githubUser.name, avatar: githubUser.avatar_url },
        authProviders: [{ provider: 'github', providerId: githubUser.id.toString() }],
        isVerified: true
      });
    } else {
      if (!user.authProviders.some(p => p.provider === 'github')) {
        user.authProviders.push({ provider: 'github', providerId: githubUser.id.toString() });
        await user.save();
      }
    }

    const accessToken = generateAccessToken(user);
    const refreshTokenString = generateRefreshTokenString();
    
    await Session.create({
      userId: user._id,
      sessionId: crypto.randomUUID(),
      ipHash: crypto.createHash('sha256').update(req.ip || 'unknown').digest('hex'),
      userAgent: req.headers['user-agent'],
      location: 'unknown', 
      lastActiveAt: new Date()
    });

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(refreshTokenString),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    user.lastLoginAt = new Date();
    await user.save();

    setRefreshTokenCookie(res, refreshTokenString);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/success?token=${accessToken}`);
  } catch (error) { next(error); }
};

// =======================
// Account Recovery 
// =======================
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    
    // Always return success to mitigate email enumeration attacks
    if (!user) return res.status(200).json({ success: true, message: 'If registered, a reset link was sent' });

    const resetToken = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = hashToken(resetToken);
    user.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password/${resetToken}`;
    console.log(`\n\n[MOCK EMAIL DISPATCH]: Reset password link for ${email}: \n${resetUrl}\n\n`);

    res.status(200).json({ success: true, message: 'If registered, a reset link was sent' });
  } catch (error) { next(error); }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    
    // Enforce Password Policy 
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/;
    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters, include an uppercase letter, a number, and a special character.' });
    }

    const hashedToken = hashToken(token);
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    }).select('+passwordHash');

    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired token' });

    user.passwordHash = await hashPassword(newPassword);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    // Zero Trust: Wipe ALL existing sessions and refresh tokens on password change
    await RefreshToken.updateMany({ userId: user._id }, { revoked: true });
    await Session.deleteMany({ userId: user._id });

    await user.save();

    res.status(200).json({ success: true, message: 'Password reset successful. Please log in.' });
  } catch (error) { next(error); }
};

exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    const hashedToken = hashToken(token);
    
    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpire: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ success: false, message: 'Invalid or expired verification URL' });

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpire = undefined;
    await user.save();

    res.status(200).json({ success: true, message: 'Email successfully verified' });
  } catch (error) { next(error); }
};

// =======================
// Session Management
// =======================
exports.getSessions = async (req, res, next) => {
  try {
    const sessions = await Session.find({ userId: req.user.id });
    res.status(200).json({ success: true, data: sessions });
  } catch (error) {
    next(error);
  }
};

exports.deleteSession = async (req, res, next) => {
  try {
    await Session.findOneAndDelete({ sessionId: req.params.id, userId: req.user.id });
    res.status(200).json({ success: true, message: 'Session terminated' });
  } catch (error) {
    next(error);
  }
};

exports.deleteAllOtherSessions = async (req, res, next) => {
  try {
    await Session.deleteMany({ userId: req.user.id, sessionId: { $ne: req.user.sessionId } });
    res.status(200).json({ success: true, message: 'All other sessions terminated' });
  } catch (error) {
    next(error);
  }
};

// =======================
// MFA Handlers
// =======================
exports.setupMfa = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('+mfaSecret +mfaBackupCodes +mfaEnabled');
    if (user.mfaEnabled) return res.status(400).json({ success: false, message: 'MFA is already active' });

    const secret = authenticator.generateSecret();
    user.mfaSecret = encryptSymmetric(secret);
    
    // Generate 8 backup codes of 8 characters each
    const backupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(4).toString('hex'));
    user.mfaBackupCodes = backupCodes.map(code => hashToken(code)); // Store hashed backup codes securely
    
    await user.save();

    const otpauth = authenticator.keyuri(user.email, 'BlogPlatform', secret);
    const qrCodeDataUrl = await qrcode.toDataURL(otpauth);

    res.status(200).json({ success: true, qrCode: qrCodeDataUrl, secret, backupCodes });
  } catch (error) { next(error); }
};

exports.verifyMfaSetup = async (req, res, next) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user.id).select('+mfaSecret +mfaEnabled');
    if (!user.mfaSecret) return res.status(400).json({ success: false, message: 'MFA setup not initiated' });

    const secret = decryptSymmetric(user.mfaSecret);
    const isValid = authenticator.check(token, secret);

    if (!isValid) return res.status(400).json({ success: false, message: 'Invalid TOTP token' });

    user.mfaEnabled = true;
    await user.save();

    res.status(200).json({ success: true, message: 'MFA enabled successfully' });
  } catch (error) { next(error); }
};

exports.mfaChallenge = async (req, res, next) => {
  try {
    const { userId, token } = req.body; 
    const user = await User.findById(userId).select('+mfaSecret +mfaBackupCodes +role');
    if (!user || (!user.mfaSecret && user.mfaBackupCodes.length === 0)) {
      return res.status(401).json({ success: false, message: 'Invalid request' });
    }
    
    const secret = decryptSymmetric(user.mfaSecret);
    let isValid = authenticator.check(token, secret);

    if (!isValid && token.length === 8) {
      const hashed = hashToken(token);
      if (user.mfaBackupCodes.includes(hashed)) {
        isValid = true;
        user.mfaBackupCodes = user.mfaBackupCodes.filter(c => c !== hashed);
        await user.save();
      }
    }

    if (!isValid) return res.status(401).json({ success: false, message: 'Invalid MFA token' });

    const accessToken = generateAccessToken(user);
    const refreshTokenString = generateRefreshTokenString();
    
    const ipHash = crypto.createHash('sha256').update(req.ip || 'unknown').digest('hex');
    const sessionId = crypto.randomUUID();

    await Session.create({
      userId: user._id,
      sessionId,
      ipHash,
      userAgent: req.headers['user-agent'],
      location: 'unknown', 
      lastActiveAt: new Date()
    });

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(refreshTokenString),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 
      deviceInfo: req.headers['user-agent']
    });

    user.lastLoginAt = new Date();
    await user.save();

    setRefreshTokenCookie(res, refreshTokenString);

    res.status(200).json({ 
      success: true, 
      accessToken,
      user: { id: user._id, username: user.username, role: user.role }
    });
  } catch (error) { next(error); }
};
