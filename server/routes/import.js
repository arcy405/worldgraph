const express = require('express');
const router = express.Router();
const Node = require('../models/Node');
const Edge = require('../models/Edge');

// Import nodes and edges from JSON
router.post('/json', async (req, res) => {
  try {
    const { nodes, edges, workspace = 'default' } = req.body;
    
    if (!nodes || !Array.isArray(nodes)) {
      return res.status(400).json({ error: 'nodes array is required' });
    }
    
    // Insert nodes
    const nodeData = nodes.map(node => ({
      ...node,
      workspace,
      metadata: node.metadata ? new Map(Object.entries(node.metadata)) : new Map()
    }));
    
    const insertedNodes = await Node.insertMany(nodeData, { ordered: false });
    console.log(`Imported ${insertedNodes.length} nodes`);
    
    // Create node map for edges
    const nodeMap = {};
    insertedNodes.forEach(node => {
      nodeMap[node.label] = node._id;
    });
    
    // Also check existing nodes for edge connections
    const existingNodes = await Node.find({ workspace });
    existingNodes.forEach(node => {
      if (!nodeMap[node.label]) {
        nodeMap[node.label] = node._id;
      }
    });
    
    let insertedEdges = [];
    if (edges && Array.isArray(edges)) {
      const edgeData = edges
        .filter(edge => nodeMap[edge.fromLabel] && nodeMap[edge.toLabel])
        .map(edge => ({
          from: nodeMap[edge.fromLabel],
          to: nodeMap[edge.toLabel],
          label: edge.label || 'related',
          weight: edge.weight || 1,
          workspace,
          metadata: edge.metadata ? new Map(Object.entries(edge.metadata)) : new Map()
        }));
      
      if (edgeData.length > 0) {
        insertedEdges = await Edge.insertMany(edgeData, { ordered: false });
        console.log(`Imported ${insertedEdges.length} edges`);
      }
    }
    
    res.json({
      message: 'Import successful',
      nodesImported: insertedNodes.length,
      edgesImported: insertedEdges.length
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Import from CSV (simplified - expects label,group,year,info format)
router.post('/csv', async (req, res) => {
  try {
    const { csv, workspace = 'default' } = req.body;
    
    if (!csv) {
      return res.status(400).json({ error: 'CSV data is required' });
    }
    
    const lines = csv.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    const nodes = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const node = {};
      
      headers.forEach((header, index) => {
        if (values[index]) {
          if (header === 'year') {
            node[header] = parseInt(values[index]);
          } else if (header === 'tags') {
            node[header] = values[index].split(';').map(t => t.trim());
          } else {
            node[header] = values[index];
          }
        }
      });
      
      if (node.label && node.group) {
        node.workspace = workspace;
        nodes.push(node);
      }
    }
    
    if (nodes.length === 0) {
      return res.status(400).json({ error: 'No valid nodes found in CSV' });
    }
    
    const insertedNodes = await Node.insertMany(nodes, { ordered: false });
    
    res.json({
      message: 'CSV import successful',
      nodesImported: insertedNodes.length
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;

