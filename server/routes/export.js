const express = require('express');
const router = express.Router();
const Node = require('../models/Node');
const Edge = require('../models/Edge');

// Export nodes and edges as JSON
router.get('/json', async (req, res) => {
  try {
    const { workspace = 'default' } = req.query;
    
    const nodes = await Node.find({ workspace });
    const edges = await Edge.find({ workspace }).populate('from to', 'label');
    
    // Format for export
    const exportNodes = nodes.map(node => ({
      label: node.label,
      group: node.group,
      year: node.year,
      info: node.info,
      tags: node.tags || [],
      metadata: node.metadata ? Object.fromEntries(node.metadata) : {}
    }));
    
    const exportEdges = edges.map(edge => ({
      fromLabel: edge.from.label,
      toLabel: edge.to.label,
      label: edge.label,
      weight: edge.weight || 1,
      metadata: edge.metadata ? Object.fromEntries(edge.metadata) : {}
    }));
    
    res.json({
      workspace,
      exportedAt: new Date().toISOString(),
      nodes: exportNodes,
      edges: exportEdges
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export as CSV
router.get('/csv', async (req, res) => {
  try {
    const { workspace = 'default' } = req.query;
    
    const nodes = await Node.find({ workspace });
    
    // CSV header
    const headers = ['label', 'group', 'year', 'info', 'tags'];
    let csv = headers.join(',') + '\n';
    
    nodes.forEach(node => {
      const row = [
        `"${node.label}"`,
        `"${node.group}"`,
        node.year || '',
        `"${(node.info || '').replace(/"/g, '""')}"`,
        `"${(node.tags || []).join(';')}"`
      ];
      csv += row.join(',') + '\n';
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=worldgraph-${workspace}-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

