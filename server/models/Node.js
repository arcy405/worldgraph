const mongoose = require('mongoose');

const nodeSchema = new mongoose.Schema({
  label: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  group: {
    type: String,
    required: true,
    trim: true,
    index: true
    // Removed enum - now supports any entity type
  },
  year: {
    type: Number,
    // Removed min/max constraints - supports any year
    index: true
  },
  info: {
    type: String,
    required: true,
    trim: true
  },
  // Flexible metadata for custom fields
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  // Workspace/domain separation
  workspace: {
    type: String,
    default: 'default',
    index: true
  },
  // Tags for categorization
  tags: [{
    type: String,
    trim: true,
    index: true
  }]
}, {
  timestamps: true
});

// Compound indexes for common queries
nodeSchema.index({ workspace: 1, group: 1 });
nodeSchema.index({ workspace: 1, year: 1 });
nodeSchema.index({ workspace: 1, label: 'text', info: 'text' });

module.exports = mongoose.model('Node', nodeSchema);


