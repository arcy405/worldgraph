const mongoose = require('mongoose');

const edgeSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Node',
    required: true,
    index: true
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Node',
    required: true,
    index: true
  },
  label: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  // Edge weight for relationship strength
  weight: {
    type: Number,
    default: 1,
    min: 0,
    max: 10
  },
  // Flexible metadata for edge properties
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
  }
}, {
  timestamps: true
});

// Prevent duplicate edges per workspace
edgeSchema.index({ workspace: 1, from: 1, to: 1 }, { unique: true });
edgeSchema.index({ workspace: 1, label: 1 });

module.exports = mongoose.model('Edge', edgeSchema);


