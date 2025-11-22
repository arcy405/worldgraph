const express = require('express');
const router = express.Router();
const Node = require('../models/Node');
const Edge = require('../models/Edge');

// Get complete graph with filters
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
      limit = 1000,
      includeMetadata = false
    } = req.query;
    
    // Build node query
    let nodeQuery = { workspace };
    
    if (search) {
      nodeQuery.$or = [
        { label: { $regex: search, $options: 'i' } },
        { info: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (types) {
      const typeArray = types.split(',').map(t => t.trim());
      nodeQuery.group = { $in: typeArray };
    }
    
    if (maxYear || minYear) {
      nodeQuery.year = {};
      if (maxYear) {
        nodeQuery.year.$lte = parseInt(maxYear);
      }
      if (minYear) {
        nodeQuery.year.$gte = parseInt(minYear);
      }
    }
    
    if (tags) {
      const tagArray = tags.split(',').map(t => t.trim());
      nodeQuery.tags = { $in: tagArray };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalCount = await Node.countDocuments(nodeQuery);

    // Get filtered nodes with pagination
    const nodes = await Node.find(nodeQuery)
      .sort({ year: -1 })
      .limit(parseInt(limit))
      .skip(skip);
    
    const nodeIds = nodes.map(n => {
      const id = n._id || n.id;
      return id.toString ? id.toString() : String(id);
    });

    // Get edges only between visible nodes
    const edges = await Edge.find({
      workspace,
      from: { $in: nodeIds },
      to: { $in: nodeIds }
    }).populate('from to', 'label group year info');

    // Format for vis-network
    const formattedNodes = nodes.map(node => {
      const nodeData = {
        id: node._id.toString(),
        label: node.label,
        group: node.group,
        year: node.year,
        info: node.info,
        tags: node.tags || []
      };
      
      if (includeMetadata === 'true' && node.metadata) {
        nodeData.metadata = Object.fromEntries(node.metadata);
      }
      
      return nodeData;
    });

    const formattedEdges = edges.map(edge => {
      const fromId = edge.from?._id?.toString() || edge.from?.toString() || edge.from;
      const toId = edge.to?._id?.toString() || edge.to?.toString() || edge.to;
      
      const edgeData = {
        id: edge._id.toString(),
        from: fromId,
        to: toId,
        label: edge.label,
        weight: edge.weight || 1
      };
      
      if (includeMetadata === 'true' && edge.metadata) {
        edgeData.metadata = Object.fromEntries(edge.metadata);
      }
      
      return edgeData;
    });

    res.json({
      nodes: formattedNodes,
      edges: formattedEdges,
      count: nodes.length,
      totalCount,
      page: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get graph statistics
router.get('/stats', async (req, res) => {
  try {
    const { workspace = 'default' } = req.query;
    
    const nodeCount = await Node.countDocuments({ workspace });
    const edgeCount = await Edge.countDocuments({ workspace });
    
    const groupStats = await Node.aggregate([
      { $match: { workspace } },
      { $group: { _id: '$group', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const yearRange = await Node.aggregate([
      { $match: { workspace, year: { $exists: true, $ne: null } } },
      { $group: {
        _id: null,
        minYear: { $min: '$year' },
        maxYear: { $max: '$year' }
      }}
    ]);
    
    const avgDegree = edgeCount > 0 && nodeCount > 0 
      ? (edgeCount * 2 / nodeCount).toFixed(2)
      : 0;
    
    res.json({
      nodeCount,
      edgeCount,
      groupStats,
      yearRange: yearRange[0] || { minYear: null, maxYear: null },
      avgDegree: parseFloat(avgDegree)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Find shortest path between two nodes
router.get('/path', async (req, res) => {
  try {
    const { from, to, workspace = 'default', maxDepth = 5 } = req.query;
    
    if (!from || !to) {
      return res.status(400).json({ error: 'from and to node IDs are required' });
    }
    
    // BFS to find shortest path
    const visited = new Set();
    const queue = [[from, [from]]];
    visited.add(from.toString());
    
    let path = null;
    let depth = 0;
    
    while (queue.length > 0 && depth < parseInt(maxDepth)) {
      const levelSize = queue.length;
      
      for (let i = 0; i < levelSize; i++) {
        const [currentId, currentPath] = queue.shift();
        
        if (currentId.toString() === to.toString()) {
          path = currentPath;
          break;
        }
        
        // Get all edges from and to this node
        const edges = await Edge.find({
          workspace,
          $or: [
            { from: currentId },
            { to: currentId }
          ]
        });
        
        for (const edge of edges) {
          const nextId = edge.from.toString() === currentId.toString() 
            ? edge.to.toString() 
            : edge.from.toString();
          
          if (!visited.has(nextId)) {
            visited.add(nextId);
            queue.push([nextId, [...currentPath, nextId]]);
          }
        }
      }
      
      if (path) break;
      depth++;
    }
    
    if (!path) {
      return res.json({ path: null, message: 'No path found within max depth' });
    }
    
    // Get node details for path
    const nodes = await Node.find({ 
      _id: { $in: path },
      workspace 
    });
    
    res.json({ path, nodes, depth: path.length - 1 });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


