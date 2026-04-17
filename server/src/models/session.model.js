const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    sessionId: {
      type: String,
      required: true,
      unique: true,
    },
    ipHash: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
    },
    location: {
      type: String,
    },
    lastActiveAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// TTL Index - Sessions expire after 7 days automatically if completely inactive
sessionSchema.index({ lastActiveAt: 1 }, { expireAfterSeconds: 604800 });

module.exports = mongoose.model('Session', sessionSchema);
