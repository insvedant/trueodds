const mongoose = require('mongoose')

const chatMessageSchema = new mongoose.Schema({
  conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatConversation', required: true },
  sender:       { type: String, enum: ['user', 'admin'], required: true },
  senderId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text:         { type: String, required: true, maxlength: 2000 },
  read:         { type: Boolean, default: false },
  createdAt:    { type: Date, default: Date.now },
})

chatMessageSchema.index({ conversation: 1, createdAt: 1 })

module.exports = mongoose.model('ChatMessage', chatMessageSchema)
