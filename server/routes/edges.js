const express = require('express');
const router = express.Router();
const Edge = require('../models/Edge');
const Node = require('../models/Node');

// Get all edges
router.get('/', async (req, res) => {
  try {
    const { workspace = 'default', page = 1, limit = 100 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalCount = await Edge.countDocuments({ workspace });
    
    const edges = await Edge.find({ workspace })
      .populate('from to', 'label group year')
      .limit(parseInt(limit))
      .skip(skip);
    
    res.json({
      edges,
      totalCount,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get edges for specific nodes
router.get('/filtered', async (req, res) => {
  try {
    const { nodeIds } = req.query;
    if (!nodeIds) {
      return res.json([]);
    }
    const ids = nodeIds.split(',').map(id => id.trim());
    const edges = await Edge.find({
      from: { $in: ids },
      to: { $in: ids }
    }).populate('from to', 'label group year');
    res.json(edges);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single edge
router.get('/:id', async (req, res) => {
  try {
    const edge = await Edge.findById(req.params.id).populate('from to');
    if (!edge) {
      return res.status(404).json({ error: 'Edge not found' });
    }
    res.json(edge);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create edge
router.post('/', async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.from || !req.body.to || !req.body.label) {
      return res.status(400).json({ error: 'from, to, and label are required' });
    }
    
    // Verify nodes exist
    const fromNode = await Node.findById(req.body.from);
    const toNode = await Node.findById(req.body.to);
    
    if (!fromNode || !toNode) {
      return res.status(400).json({ error: 'Invalid node IDs' });
    }
    
    // Sanitize workspace name
    const workspace = (fromNode.workspace || toNode.workspace || req.body.workspace || 'default')
      .replace(/[^a-zA-Z0-9_-]/g, '');
    
    // Ensure nodes are in same workspace
    if (fromNode.workspace !== toNode.workspace) {
      return res.status(400).json({ error: 'Nodes must be in the same workspace' });
    }
    
    // Sanitize and validate edge data
    const edgeData = {
      from: req.body.from,
      to: req.body.to,
      label: String(req.body.label).trim().substring(0, 200),
      weight: req.body.weight ? Math.max(0, Math.min(10, parseFloat(req.body.weight))) : 1,
      workspace
    };
    
    // Convert metadata object to Map if provided
    if (req.body.metadata && typeof req.body.metadata === 'object') {
      const entries = Object.entries(req.body.metadata).slice(0, 50);
      const metadataMap = new Map();
      entries.forEach(([key, value]) => {
        const sanitizedKey = String(key).trim().substring(0, 100);
        const sanitizedValue = typeof value === 'string' 
          ? value.substring(0, 1000) 
          : value;
        metadataMap.set(sanitizedKey, sanitizedValue);
      });
      edgeData.metadata = metadataMap;
    }

    const edge = new Edge(edgeData);
    await edge.save();
    const populatedEdge = await Edge.findById(edge._id).populate('from to', 'label group year');
    res.status(201).json(populatedEdge);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Edge already exists in this workspace' });
    }
    res.status(400).json({ error: error.message });
  }
});

// Update edge
router.put('/:id', async (req, res) => {
  try {
    const edge = await Edge.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('from to', 'label group year');
    
    if (!edge) {
      return res.status(404).json({ error: 'Edge not found' });
    }
    res.json(edge);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete edge
router.delete('/:id', async (req, res) => {
  try {
    const edge = await Edge.findByIdAndDelete(req.params.id);
    if (!edge) {
      return res.status(404).json({ error: 'Edge not found' });
    }
    res.json({ message: 'Edge deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


