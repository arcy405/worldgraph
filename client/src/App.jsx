import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import Graph from './components/Graph';
import Inspector from './components/Inspector';
import InsightsPanel from './components/InsightsPanel';
import StoryMode from './components/StoryMode';
import { fetchGraphData, fetchGraphStats } from './services/api';

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [filters, setFilters] = useState({
    search: '',
    types: [],
    maxYear: null,
    minYear: null,
    workspace: 'default',
    tags: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [availableTypes, setAvailableTypes] = useState([]);
  const [showInsights, setShowInsights] = useState(true);
  const [graphContainerRef, setGraphContainerRef] = useState(null);
  const [storyMode, setStoryMode] = useState({ active: false, from: null, to: null });

  const loadGraphData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGraphData({ ...filters, limit: 1000 });
      console.log('Graph data received:', data);
      console.log('Nodes count:', data.nodes?.length);
      console.log('Edges count:', data.edges?.length);
      
      setGraphData(data);
      
      // Extract unique types from nodes
      if (data.nodes && data.nodes.length > 0) {
        const types = [...new Set(data.nodes.map(n => n.group))];
        setAvailableTypes(types);
      } else {
        setAvailableTypes([]);
      }
      
      // Load stats
      try {
        const statsData = await fetchGraphStats(filters.workspace);
        setStats(statsData);
      } catch (err) {
        console.warn('Could not load stats:', err);
      }
    } catch (error) {
      console.error('Error loading graph data:', error);
      setError(error.message || 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleNodeSelect = (node) => {
    setSelectedNode(node);
    
    // If story mode is active and we have a from node, set to node
    if (storyMode.active && storyMode.from && !storyMode.to) {
      setStoryMode(prev => ({ ...prev, to: node }));
    }
  };
  
  const handleStartStory = (fromNode, toNode) => {
    setStoryMode({ active: true, from: fromNode, to: toNode });
  };

  const handleInsightNodeSelect = (nodeData) => {
    // Find the full node data from graphData
    const fullNode = graphData.nodes.find(n => n.id === nodeData.id);
    if (fullNode) {
      setSelectedNode(fullNode);
      // Could also highlight the node in the graph here
    }
  };

  const handleDataChange = () => {
    // Reload graph data when nodes/edges are added/updated
    loadGraphData();
  };

  const handleGraphReady = useCallback((network) => {
    // Store reference to graph container
    const container = document.getElementById('graph-canvas');
    if (container) {
      setGraphContainerRef({ current: container });
    }
  }, []);

  return (
    <div className="app">
      <Sidebar
        filters={filters}
        onFilterChange={handleFilterChange}
        nodeCount={graphData.count || graphData.nodes.length}
        totalCount={graphData.totalCount}
        availableTypes={availableTypes}
        stats={stats}
        onDataChange={handleDataChange}
        graphContainerRef={graphContainerRef}
      />
      <div className="main">
        {loading ? (
          <div className="loading">Loading graph...</div>
        ) : error ? (
          <div className="error">Error: {error}</div>
        ) : graphData.nodes && Array.isArray(graphData.nodes) && graphData.nodes.length > 0 ? (
          <>
          <Graph
            nodes={graphData.nodes || []}
            edges={graphData.edges || []}
            onNodeSelect={handleNodeSelect}
            onGraphReady={handleGraphReady}
          />
            {showInsights && (
              <InsightsPanel 
                workspace={filters.workspace}
                onNodeSelect={handleInsightNodeSelect}
                onClose={() => setShowInsights(false)}
              />
            )}
            {!showInsights && (
              <button 
                className="insights-toggle-btn"
                onClick={() => setShowInsights(true)}
                title="Show Insights"
              >
                💡 Insights
              </button>
            )}
            {storyMode.active && (
              <StoryMode
                fromNode={storyMode.from}
                toNode={storyMode.to}
                workspace={filters.workspace}
                nodes={graphData.nodes}
                onNodeSelect={handleNodeSelect}
                onClose={() => setStoryMode({ active: false, from: null, to: null })}
              />
            )}
          </>
        ) : (
          <div className="loading">
            <div>No data found</div>
            <div style={{ marginTop: '10px', fontSize: '14px', color: 'var(--text-muted)' }}>
              Make sure:
              <ul style={{ textAlign: 'left', display: 'inline-block', marginTop: '10px' }}>
                <li>Server is running on port 5001</li>
                <li>MongoDB is running</li>
                <li>Database has been seeded (run: npm run seed)</li>
                <li>Workspace is set to "default"</li>
              </ul>
            </div>
          </div>
        )}
      </div>
      <Inspector 
        selectedNode={selectedNode} 
        workspace={filters.workspace}
        onNodeUpdate={handleDataChange}
        onStartStory={(node) => {
          // Prompt for second node or use selected
          const toNode = window.prompt('Enter the name of the target node for the story:');
          if (toNode) {
            const foundNode = graphData.nodes.find(n => 
              n.label.toLowerCase().includes(toNode.toLowerCase())
            );
            if (foundNode) {
              handleStartStory(node, foundNode);
            } else {
              alert('Node not found. Please select a node from the graph.');
            }
          }
        }}
      />
    </div>
  );
}

export default App;


