const mongoose = require('mongoose')

const BlogPostSchema = new mongoose.Schema({
  title:      { type: String, required: true },
  slug:       { type: String, required: true, unique: true },
  excerpt:    { type: String, default: '' },
  content:    { type: String, default: '' },
  category:   { type: String, default: 'Guide' },
  emoji:      { type: String, default: '📖' },
  tags:       [{ type: String }],
  status:     { type: String, enum: ['published','draft'], default: 'draft' },
  readTime:   { type: Number, default: 5 },
  author:     { type: String, default: 'TrueOdds Team' },
  hot:        { type: Boolean, default: false },
  hotAt:      { type: Date, default: null },
}, { timestamps: true })

module.exports = mongoose.model('BlogPost', BlogPostSchema)
