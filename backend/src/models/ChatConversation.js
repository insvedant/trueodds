const mongoose = require('mongoose')

const chatConversationSchema = new mongoose.Schema({
  user:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:      { type: String, enum: ['open', 'active', 'resolved'], default: 'open' },
  subject:     { type: String, default: 'Support Chat' },
  unreadAdmin: { type: Number, default: 0 },  // unread for admin
  unreadUser:  { type: Number, default: 0 },  // unread for user
  lastMessage: { type: String, default: '' },
  lastMessageAt: { type: Date, default: Date.now },
  createdAt:   { type: Date, default: Date.now },
})

module.exports = mongoose.model('ChatConversation', chatConversationSchema)
