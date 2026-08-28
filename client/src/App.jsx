import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Graph from './components/Graph';
import Inspector from './components/Inspector';
import InsightsPanel from './components/InsightsPanel';
import StoryMode from './components/StoryMode';
import { fetchGraphData, fetchGraphStats, fetchNeighborhood } from './services/api';

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
  const [panelOpen, setPanelOpen] = useState(true);
  // When set, the canvas shows this node's neighbourhood instead of the whole
  // workspace - the difference between 220 nodes and 870.
  const [focus, setFocus] = useState(null);
  const [hops, setHops] = useState(1);
  const [truncated, setTruncated] = useState(false);

  const loadGraphData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      if (focus) {
        // Focused view: one node's neighbourhood, walked server-side.
        const result = await fetchNeighborhood({
          workspace: filters.workspace,
          nodeId: focus.id,
          hops,
          limit: 400
        });
        data = result;
        setTruncated(Boolean(result.truncated));
      } else {
        data = await fetchGraphData({ ...filters, limit: 1000 });
        setTruncated(false);
      }

      setGraphData(data);
      setAvailableTypes(
        data.nodes?.length ? [...new Set(data.nodes.map(n => n.group))] : []
      );

      try {
        setStats(await fetchGraphStats(filters.workspace));
      } catch (err) {
        console.warn('Could not load stats:', err);
      }
    } catch (error) {
      console.error('Error loading graph data:', error);
      setError(error.response?.data?.error || error.message || 'Failed to load graph data');
    } finally {
      setLoading(false);
    }
  }, [filters, focus, hops]);

  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleNodeSelect = (node) => {
    setSelectedNode(node);

    // Story mode is picking a second endpoint - don't hijack the click.
    if (storyMode.active && storyMode.from && !storyMode.to) {
      setStoryMode(prev => ({ ...prev, to: node }));
      return;
    }

    // Otherwise clicking a node scopes the canvas to it and its connections.
    setFocus({ id: node.id, label: node.label });
  };
  
  const handleStartStory = (fromNode, toNode) => {
    setStoryMode({ active: true, from: fromNode, to: toNode });
  };

  const focusOnNode = useCallback((node) => {
    if (!node) return;
    setFocus({ id: node.id, label: node.label });
    setSelectedNode(node);
  }, []);

  const clearFocus = useCallback(() => {
    setFocus(null);
    setTruncated(false);
  }, []);

  // Leaving a workspace should not keep you focused on a node from the old one.
  useEffect(() => { setFocus(null); }, [filters.workspace]);

  const handleInsightNodeSelect = (nodeData) => {
    // Focus rather than merely select: an insight names a node, and the useful
    // response is to go look at it.
    const fullNode = graphData.nodes.find(n => n.id === nodeData.id) || nodeData;
    if (fullNode?.id) focusOnNode(fullNode);
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
      {/* The graph is the base layer; everything else floats above it. */}
      <div className="canvas">
        {loading ? (
          <div className="state-panel">
            <div className="state-spinner" />
            <p>Loading graph…</p>
          </div>
        ) : error ? (
          <div className="state-panel state-error">
            <h3>Could not load the graph</h3>
            <p>{error}</p>
          </div>
        ) : graphData.nodes && graphData.nodes.length > 0 ? (
          <Graph
            nodes={graphData.nodes || []}
            edges={graphData.edges || []}
            onNodeSelect={handleNodeSelect}
            onNodeFocus={focusOnNode}
            focusId={focus?.id}
            onGraphReady={handleGraphReady}
          />
        ) : (
          <div className="state-panel">
            <div className="state-glyph" aria-hidden="true">◈</div>
            <h3>This workspace is empty</h3>
            <p>
              Pull real entities in from Wikipedia, OpenAlex, arXiv and four other
              sources using the <strong>Pull from the web</strong> panel.
            </p>
          </div>
        )}
      </div>

      {focus && (
        <div className="focus-bar">
          <span className="focus-label">
            Focused on <strong>{focus.label}</strong>
          </span>
          <div className="focus-hops">
            {[1, 2, 3].map(h => (
              <button
                key={h}
                className={hops === h ? 'is-on' : ''}
                onClick={() => setHops(h)}
              >
                {h} hop{h > 1 ? 's' : ''}
              </button>
            ))}
          </div>
          {truncated && <span className="focus-warn">capped at 400</span>}
          <button className="focus-clear" onClick={clearFocus}>Show whole workspace</button>
        </div>
      )}

      <TopBar
        filters={filters}
        onFilterChange={handleFilterChange}
        stats={stats}
        nodeCount={graphData.nodes?.length || 0}
        edgeCount={graphData.edges?.length || 0}
        refreshKey={stats}
        showInsights={showInsights}
        onToggleInsights={() => setShowInsights(v => !v)}
        onFocusNode={focusOnNode}
      />

      <button
        className={`rail-toggle ${panelOpen ? 'is-open' : ''}`}
        onClick={() => setPanelOpen(v => !v)}
        title={panelOpen ? 'Hide controls' : 'Show controls'}
        aria-expanded={panelOpen}
      >
        {panelOpen ? '‹' : '›'}
      </button>

      <div className={`rail ${panelOpen ? 'is-open' : 'is-closed'}`}>
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
      </div>

      {selectedNode && (
        <div className="dock-right">
          <Inspector
            selectedNode={selectedNode}
            workspace={filters.workspace}
            onNodeUpdate={handleDataChange}
            onFocus={() => focusOnNode(selectedNode)}
            isFocused={focus?.id === selectedNode.id}
            onOpenNode={focusOnNode}
            onClose={() => setSelectedNode(null)}
            onStartStory={(node) => {
              const toNode = window.prompt('Tell the story between this node and which other?');
              if (!toNode) return;
              const foundNode = graphData.nodes.find(n =>
                n.label.toLowerCase().includes(toNode.toLowerCase())
              );
              if (foundNode) {
                handleStartStory(node, foundNode);
              } else {
                alert('No node matched that name. Try selecting it in the graph.');
              }
            }}
          />
        </div>
      )}

      {showInsights && graphData.nodes.length > 0 && (
        <InsightsPanel
          workspace={filters.workspace}
          onNodeSelect={handleInsightNodeSelect}
          onClose={() => setShowInsights(false)}
        />
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
    </div>
  );
}

export default App;


