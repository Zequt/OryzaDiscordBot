const mongoose = require('mongoose');

const reminderSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true
    },
    userId: {
        type: String,
        required: true
    },
    mentionUserId: {
        type: String,
        required: false
    },
    message: {
        type: String,
        required: true
    },
    time: {
        type: Date,
        required: true
    },
    channelId: {
        type: String,
        required: true
    },
    guildId: {
        type: String,
        required: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Compound indexes for efficient queries
reminderSchema.index({ userId: 1, time: 1 });
reminderSchema.index({ time: 1 });

module.exports = mongoose.model('Reminder', reminderSchema);