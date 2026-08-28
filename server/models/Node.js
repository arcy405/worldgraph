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
  }],
  // Stable identifier in the originating system (e.g. a Wikidata QID). Set by
  // ingestion so re-running the same topic updates nodes instead of duplicating
  // them. Absent on hand-authored nodes.
  externalId: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    trim: true,
    default: 'manual',
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for common queries
nodeSchema.index({ workspace: 1, group: 1 });
nodeSchema.index({ workspace: 1, year: 1 });
nodeSchema.index({ workspace: 1, label: 'text', info: 'text' });

// One node per (workspace, source, external id). `source` is part of the key
// because each source uses its own native identifiers and two of them could
// legitimately mint the same string.
//
// A partial filter (rather than `sparse`) is required: in a compound sparse
// index a document is indexed when *any* key is present, and `workspace`
// always is - so every hand-authored node would index externalId as null and
// the second one would collide.
nodeSchema.index(
  { workspace: 1, source: 1, externalId: 1 },
  { unique: true, partialFilterExpression: { externalId: { $type: 'string' } } }
);

module.exports = mongoose.model('Node', nodeSchema);


