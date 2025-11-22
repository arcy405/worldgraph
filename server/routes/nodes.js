const express = require('express');
const router = express.Router();
const Node = require('../models/Node');

// Get all nodes
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      types, 
      maxYear, 
      minYear,
      workspace = 'default',
      tags,
      page = 1,
      limit = 100
    } = req.query;
    
    let query = { workspace };

    if (search) {
      query.$or = [
        { label: { $regex: search, $options: 'i' } },
        { info: { $regex: search, $options: 'i' } }
      ];
    }

    if (types) {
      const typeArray = types.split(',').map(t => t.trim());
      query.group = { $in: typeArray };
    }

    if (maxYear || minYear) {
      query.year = {};
      if (maxYear) {
        query.year.$lte = parseInt(maxYear);
      }
      if (minYear) {
        query.year.$gte = parseInt(minYear);
      }
    }
    
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim());
      query.tags = { $in: tagArray };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalCount = await Node.countDocuments(query);
    
    const nodes = await Node.find(query)
      .sort({ year: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    res.json({
      nodes,
      totalCount,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single node
router.get('/:id', async (req, res) => {
  try {
    const node = await Node.findById(req.params.id);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    res.json(node);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create node
router.post('/', async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.label || !req.body.group) {
      return res.status(400).json({ error: 'label and group are required' });
    }
    
    // Sanitize workspace name (alphanumeric, dash, underscore only)
    const workspace = (req.body.workspace || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
    
    // Set default workspace if not provided
    const nodeData = {
      label: String(req.body.label).trim().substring(0, 500),
      group: String(req.body.group).trim().substring(0, 100),
      info: req.body.info ? String(req.body.info).trim().substring(0, 5000) : '',
      year: req.body.year ? parseInt(req.body.year) : null,
      workspace,
      tags: Array.isArray(req.body.tags) 
        ? req.body.tags.map(t => String(t).trim().substring(0, 50)).filter(t => t)
        : []
    };
    
    // Convert metadata object to Map if provided (limit size)
    if (nodeData.metadata && typeof nodeData.metadata === 'object') {
      const entries = Object.entries(nodeData.metadata).slice(0, 50); // Limit to 50 fields
      const metadataMap = new Map();
      entries.forEach(([key, value]) => {
        const sanitizedKey = String(key).trim().substring(0, 100);
        const sanitizedValue = typeof value === 'string' 
          ? value.substring(0, 1000) 
          : value;
        metadataMap.set(sanitizedKey, sanitizedValue);
      });
      nodeData.metadata = metadataMap;
    }
    
    const node = new Node(nodeData);
    await node.save();
    res.status(201).json(node);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update node
router.put('/:id', async (req, res) => {
  try {
    const node = await Node.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    res.json(node);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete node
router.delete('/:id', async (req, res) => {
  try {
    const node = await Node.findByIdAndDelete(req.params.id);
    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }
    res.json({ message: 'Node deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


