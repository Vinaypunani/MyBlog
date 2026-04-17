const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: {
      type: String,
      select: false, // Exclude from standard queries
    },
    role: {
      type: String,
      enum: ['super_admin', 'admin', 'editor', 'author', 'reader'],
      default: 'reader',
    },
    permissions: [{ type: String }],
    profile: {
      displayName: { type: String, trim: true },
      avatar: { type: String },
      bio: { type: String, maxlength: 500 },
      website: { type: String },
      socialLinks: {
        twitter: String,
        github: String,
        linkedin: String,
      },
    },
    authProviders: [
      {
        provider: { type: String, enum: ['google', 'github'] },
        providerId: { type: String },
      },
    ],
    mfaEnabled: {
      type: Boolean,
      default: false,
    },
    mfaSecret: {
      type: String,
      select: false,
    },
    mfaBackupCodes: {
      type: [String],
      select: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isSuspended: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    lastLoginAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userSchema.index({ 'authProviders.providerId': 1 });
userSchema.index({ createdAt: -1 });

module.exports = mongoose.model('User', userSchema);
