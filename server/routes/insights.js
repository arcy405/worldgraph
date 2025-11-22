const express = require('express');
const router = express.Router();
const Node = require('../models/Node');
const Edge = require('../models/Edge');

// Get all insights for a workspace
router.get('/', async (req, res) => {
  try {
    const { workspace = 'default' } = req.query;
    
    const insights = await generateInsights(workspace);
    
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific insight type
router.get('/:type', async (req, res) => {
  try {
    const { workspace = 'default' } = req.query;
    const { type } = req.params;
    
    let insight = null;
    
    switch (type) {
      case 'unexpected-connections':
        insight = await findUnexpectedConnections(workspace);
        break;
      case 'key-insights':
        insight = await findKeyInsights(workspace);
        break;
      case 'knowledge-gaps':
        insight = await findKnowledgeGaps(workspace);
        break;
      case 'influence-analysis':
        insight = await analyzeInfluence(workspace);
        break;
      case 'temporal-patterns':
        insight = await findTemporalPatterns(workspace);
        break;
      default:
        return res.status(400).json({ error: 'Invalid insight type' });
    }
    
    res.json(insight);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate all insights
async function generateInsights(workspace) {
  const [
    unexpectedConnections,
    keyInsights,
    knowledgeGaps,
    influenceAnalysis,
    temporalPatterns
  ] = await Promise.all([
    findUnexpectedConnections(workspace),
    findKeyInsights(workspace),
    findKnowledgeGaps(workspace),
    analyzeInfluence(workspace),
    findTemporalPatterns(workspace)
  ]);
  
  return {
    unexpectedConnections,
    keyInsights,
    knowledgeGaps,
    influenceAnalysis,
    temporalPatterns,
    generatedAt: new Date().toISOString()
  };
}

// Find unexpected connections (nodes connected through multiple paths)
async function findUnexpectedConnections(workspace) {
  const nodes = await Node.find({ workspace });
  const edges = await Edge.find({ workspace }).populate('from to', 'label group');
  
  if (nodes.length < 3) {
    return { connections: [], message: 'Not enough data to find unexpected connections' };
  }
  
  // Build adjacency map
  const adjacencyMap = new Map();
  edges.forEach(edge => {
    const fromId = edge.from._id.toString();
    const toId = edge.to._id.toString();
    
    if (!adjacencyMap.has(fromId)) adjacencyMap.set(fromId, new Set());
    if (!adjacencyMap.has(toId)) adjacencyMap.set(toId, new Set());
    
    adjacencyMap.get(fromId).add(toId);
    adjacencyMap.get(toId).add(fromId);
  });
  
  // Find nodes with multiple connection paths
  const unexpectedConnections = [];
  const processed = new Set();
  
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const nodeA = nodes[i];
      const nodeB = nodes[j];
      const key = `${nodeA._id}-${nodeB._id}`;
      
      if (processed.has(key)) continue;
      processed.add(key);
      
      // Check if directly connected
      const directConnection = edges.find(e => 
        (e.from._id.toString() === nodeA._id.toString() && e.to._id.toString() === nodeB._id.toString()) ||
        (e.from._id.toString() === nodeB._id.toString() && e.to._id.toString() === nodeA._id.toString())
      );
      
      if (directConnection) continue; // Skip if already directly connected
      
      // Find paths between them (2-3 hops)
      const paths = findPaths(nodeA._id.toString(), nodeB._id.toString(), adjacencyMap, 3);
      
      if (paths.length >= 2) {
        unexpectedConnections.push({
          nodeA: {
            id: nodeA._id.toString(),
            label: nodeA.label,
            group: nodeA.group
          },
          nodeB: {
            id: nodeB._id.toString(),
            label: nodeB.label,
            group: nodeB.group
          },
          pathCount: paths.length,
          paths: paths.slice(0, 3).map(path => ({
            nodes: path.map(id => {
              const node = nodes.find(n => n._id.toString() === id);
              return node ? { id: node._id.toString(), label: node.label, group: node.group } : null;
            }).filter(Boolean),
            length: path.length
          })),
          insight: `${nodeA.label} and ${nodeB.label} are connected through ${paths.length} different paths, suggesting a strong but indirect relationship.`
        });
      }
    }
  }
  
  // Sort by path count and return top 5
  unexpectedConnections.sort((a, b) => b.pathCount - a.pathCount);
  
  return {
    type: 'unexpected-connections',
    title: 'Unexpected Connections',
    description: 'Nodes that are strongly connected through multiple indirect paths',
    connections: unexpectedConnections.slice(0, 5),
    count: unexpectedConnections.length
  };
}

// BFS to find paths between two nodes
function findPaths(start, end, adjacencyMap, maxDepth) {
  const paths = [];
  const queue = [[start, [start]]];
  const visited = new Set();
  
  while (queue.length > 0 && paths.length < 10) {
    const [current, path] = queue.shift();
    
    if (path.length > maxDepth) continue;
    
    if (current === end && path.length > 1) {
      paths.push([...path]);
      continue;
    }
    
    const neighbors = adjacencyMap.get(current) || new Set();
    for (const neighbor of neighbors) {
      if (!path.includes(neighbor)) {
        queue.push([neighbor, [...path, neighbor]]);
      }
    }
  }
  
  return paths;
}

// Find key insights (most connected nodes, clusters, etc.)
async function findKeyInsights(workspace) {
  const nodes = await Node.find({ workspace });
  const edges = await Edge.find({ workspace }).populate('from to', 'label group');
  
  if (nodes.length === 0) {
    return { insights: [], message: 'No data available' };
  }
  
  // Calculate node degrees
  const nodeDegrees = new Map();
  edges.forEach(edge => {
    const fromId = edge.from._id.toString();
    const toId = edge.to._id.toString();
    
    nodeDegrees.set(fromId, (nodeDegrees.get(fromId) || 0) + 1);
    nodeDegrees.set(toId, (nodeDegrees.get(toId) || 0) + 1);
  });
  
  // Find hubs (most connected nodes)
  const hubs = Array.from(nodeDegrees.entries())
    .map(([id, degree]) => {
      const node = nodes.find(n => n._id.toString() === id);
      return node ? { node, degree } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.degree - a.degree)
    .slice(0, 5);
  
  // Find isolated nodes
  const isolatedNodes = nodes
    .filter(node => !nodeDegrees.has(node._id.toString()))
    .slice(0, 5);
  
  // Find clusters (groups of highly connected nodes)
  const clusters = findClusters(nodes, edges);
  
  const insights = [];
  
  if (hubs.length > 0) {
    insights.push({
      type: 'hubs',
      title: 'Key Hubs',
      description: `These nodes are central to your graph, connecting to many others`,
      nodes: hubs.map(({ node, degree }) => ({
        id: node._id.toString(),
        label: node.label,
        group: node.group,
        degree,
        insight: `${node.label} is connected to ${degree} other nodes, making it a central hub.`
      }))
    });
  }
  
  if (clusters.length > 0) {
    insights.push({
      type: 'clusters',
      title: 'Connected Clusters',
      description: `Groups of nodes that are highly interconnected`,
      clusters: clusters.slice(0, 3).map(cluster => ({
        nodes: cluster.map(id => {
          const node = nodes.find(n => n._id.toString() === id);
          return node ? { id: node._id.toString(), label: node.label, group: node.group } : null;
        }).filter(Boolean),
        size: cluster.length,
        insight: `This cluster contains ${cluster.length} highly interconnected nodes.`
      }))
    });
  }
  
  return {
    type: 'key-insights',
    title: 'Key Insights',
    description: 'Important patterns and structures in your graph',
    insights
  };
}

// Find clusters using simple community detection
function findClusters(nodes, edges) {
  const adjacencyMap = new Map();
  edges.forEach(edge => {
    const fromId = edge.from._id.toString();
    const toId = edge.to._id.toString();
    
    if (!adjacencyMap.has(fromId)) adjacencyMap.set(fromId, new Set());
    if (!adjacencyMap.has(toId)) adjacencyMap.set(toId, new Set());
    
    adjacencyMap.get(fromId).add(toId);
    adjacencyMap.get(toId).add(fromId);
  });
  
  const visited = new Set();
  const clusters = [];
  
  nodes.forEach(node => {
    const nodeId = node._id.toString();
    if (visited.has(nodeId)) return;
    
    // BFS to find connected component
    const cluster = [];
    const queue = [nodeId];
    visited.add(nodeId);
    
    while (queue.length > 0) {
      const current = queue.shift();
      cluster.push(current);
      
      const neighbors = adjacencyMap.get(current) || new Set();
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      });
    }
    
    if (cluster.length >= 3) {
      clusters.push(cluster);
    }
  });
  
  return clusters.sort((a, b) => b.length - a.length);
}

// Find knowledge gaps (nodes with few connections)
async function findKnowledgeGaps(workspace) {
  const nodes = await Node.find({ workspace });
  const edges = await Edge.find({ workspace }).populate('from to', 'label group');
  
  if (nodes.length === 0) {
    return { gaps: [], message: 'No data available' };
  }
  
  // Calculate node degrees
  const nodeDegrees = new Map();
  edges.forEach(edge => {
    const fromId = edge.from._id.toString();
    const toId = edge.to._id.toString();
    
    nodeDegrees.set(fromId, (nodeDegrees.get(fromId) || 0) + 1);
    nodeDegrees.set(toId, (nodeDegrees.get(toId) || 0) + 1);
  });
  
  // Find nodes with few or no connections
  const gaps = nodes
    .map(node => ({
      node,
      degree: nodeDegrees.get(node._id.toString()) || 0
    }))
    .filter(({ degree }) => degree <= 2)
    .sort((a, b) => a.degree - b.degree)
    .slice(0, 5)
    .map(({ node, degree }) => ({
      id: node._id.toString(),
      label: node.label,
      group: node.group,
      degree,
      insight: `${node.label} has only ${degree} connection${degree !== 1 ? 's' : ''}. Consider exploring how it relates to other nodes.`
    }));
  
  return {
    type: 'knowledge-gaps',
    title: 'Knowledge Gaps',
    description: 'Nodes with few connections - opportunities to expand your graph',
    gaps,
    count: gaps.length
  };
}

// Analyze influence (nodes that connect different groups)
async function analyzeInfluence(workspace) {
  const nodes = await Node.find({ workspace });
  const edges = await Edge.find({ workspace }).populate('from to', 'label group');
  
  if (nodes.length === 0) {
    return { influencers: [], message: 'No data available' };
  }
  
  // Group nodes by type
  const nodesByType = new Map();
  nodes.forEach(node => {
    if (!nodesByType.has(node.group)) {
      nodesByType.set(node.group, []);
    }
    nodesByType.get(node.group).push(node._id.toString());
  });
  
  // Find nodes that connect different types
  const crossTypeConnections = new Map();
  
  edges.forEach(edge => {
    const fromType = edge.from.group;
    const toType = edge.to.group;
    
    if (fromType !== toType) {
      const fromId = edge.from._id.toString();
      const toId = edge.to._id.toString();
      
      crossTypeConnections.set(fromId, (crossTypeConnections.get(fromId) || 0) + 1);
      crossTypeConnections.set(toId, (crossTypeConnections.get(toId) || 0) + 1);
    }
  });
  
  const influencers = Array.from(crossTypeConnections.entries())
    .map(([id, count]) => {
      const node = nodes.find(n => n._id.toString() === id);
      return node ? { node, count } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(({ node, count }) => ({
      id: node._id.toString(),
      label: node.label,
      group: node.group,
      crossTypeConnections: count,
      insight: `${node.label} bridges ${count} connection${count !== 1 ? 's' : ''} between different entity types, making it an influential connector.`
    }));
  
  return {
    type: 'influence-analysis',
    title: 'Influential Connectors',
    description: 'Nodes that bridge different types or groups',
    influencers,
    count: influencers.length
  };
}

// Find temporal patterns
async function findTemporalPatterns(workspace) {
  const nodes = await Node.find({ workspace }).sort({ year: 1 });
  const edges = await Edge.find({ workspace }).populate('from to', 'label year');
  
  if (nodes.length < 2) {
    return { patterns: [], message: 'Not enough temporal data' };
  }
  
  const nodesWithYear = nodes.filter(n => n.year);
  if (nodesWithYear.length < 2) {
    return { patterns: [], message: 'Not enough nodes with year data' };
  }
  
  // Find time periods with most activity
  const yearCounts = new Map();
  nodesWithYear.forEach(node => {
    const year = node.year;
    yearCounts.set(year, (yearCounts.get(year) || 0) + 1);
  });
  
  const peakYears = Array.from(yearCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([year, count]) => ({
      year,
      count,
      insight: `${year} was a peak year with ${count} new entities.`
    }));
  
  // Find temporal connections (edges where nodes are from different time periods)
  const temporalEdges = edges.filter(edge => {
    const fromYear = edge.from.year;
    const toYear = edge.to.year;
    return fromYear && toYear && Math.abs(fromYear - toYear) > 5;
  }).slice(0, 5);
  
  return {
    type: 'temporal-patterns',
    title: 'Temporal Patterns',
    description: 'Time-based patterns in your graph',
    patterns: {
      peakYears,
      longTermConnections: temporalEdges.map(edge => ({
        from: {
          id: edge.from._id.toString(),
          label: edge.from.label,
          year: edge.from.year
        },
        to: {
          id: edge.to._id.toString(),
          label: edge.to.label,
          year: edge.to.year
        },
        timeSpan: Math.abs(edge.to.year - edge.from.year),
        insight: `${edge.from.label} (${edge.from.year}) connects to ${edge.to.label} (${edge.to.year}), spanning ${Math.abs(edge.to.year - edge.from.year)} years.`
      }))
    }
  };
}

module.exports = router;

