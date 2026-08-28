import React, { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { Network } from 'vis-network';
import './Graph.css';


/**
 * Node colours.
 *
 * Curated hues for the types that recur across sources, then a stable hash
 * into a fallback palette for everything else. Seven ingest sources between
 * them produce far more types than a hand-written map can cover, and sending
 * them all to one grey made most of the graph look uniform.
 */
const TYPE_COLORS = {
  Person: ['#6366f1', '#4f46e5', '#818cf8'],
  Organization: ['#8b5cf6', '#7c3aed', '#a78bfa'],
  Company: ['#8b5cf6', '#7c3aed', '#a78bfa'],
  Paper: ['#10b981', '#059669', '#34d399'],
  Publication: ['#14b8a6', '#0d9488', '#2dd4bf'],
  Book: ['#f59e0b', '#d97706', '#fbbf24'],
  Idea: ['#ec4899', '#db2777', '#f472b6'],
  Concept: ['#ec4899', '#db2777', '#f472b6'],
  Field: ['#06b6d4', '#0891b2', '#22d3ee'],
  Subject: ['#06b6d4', '#0891b2', '#22d3ee'],
  Industry: ['#eab308', '#ca8a04', '#facc15'],
  Software: ['#3b82f6', '#2563eb', '#60a5fa'],
  Event: ['#f59e0b', '#d97706', '#fbbf24'],
  Place: ['#84cc16', '#65a30d', '#a3e635'],
  Filing: ['#94a3b8', '#64748b', '#cbd5e1'],
  Exchange: ['#f97316', '#ea580c', '#fb923c'],
  Group: ['#a855f7', '#9333ea', '#c084fc'],
  // Water reads best in its own blue family, shading from stream to ocean.
  Stream: ['#67e8f9', '#22d3ee', '#a5f3fc'],
  Watercourse: ['#38bdf8', '#0ea5e9', '#7dd3fc'],
  River: ['#0ea5e9', '#0284c7', '#38bdf8'],
  Canal: ['#2dd4bf', '#14b8a6', '#5eead4'],
  Lake: ['#0891b2', '#0e7490', '#22d3ee'],
  Reservoir: ['#155e75', '#164e63', '#0e7490'],
  Bay: ['#1d4ed8', '#1e40af', '#3b82f6'],
  Strait: ['#4338ca', '#3730a3', '#6366f1'],
  Sea: ['#1e3a8a', '#172554', '#2563eb'],
  Ocean: ['#0c1a4a', '#0a1236', '#1e40af'],
  'Drainage basin': ['#65a30d', '#4d7c0f', '#84cc16'],
  // Sky: stars gold, planets cool blue, instruments and classes cooler still.
  // Computing history.
  'Programming language': ['#22c55e', '#16a34a', '#4ade80'],
  'Operating system': ['#f97316', '#ea580c', '#fb923c'],
  Hardware: ['#94a3b8', '#64748b', '#e2e8f0'],
  Algorithm: ['#a78bfa', '#8b5cf6', '#c4b5fd'],
  Standard: ['#facc15', '#eab308', '#fde047'],
  'Research institute': ['#2dd4bf', '#14b8a6', '#5eead4'],
  University: ['#14b8a6', '#0d9488', '#5eead4'],
  Star: ['#fbbf24', '#f59e0b', '#fde68a'],
  Exoplanet: ['#38bdf8', '#0ea5e9', '#7dd3fc'],
  Observatory: ['#94a3b8', '#64748b', '#cbd5e1'],
  'Spectral class': ['#c084fc', '#a855f7', '#d8b4fe'],
  'Detection method': ['#fb7185', '#f43f5e', '#fda4af'],
  Country: ['#a16207', '#854d0e', '#ca8a04'],
  Artist: ['#d946ef', '#c026d3', '#e879f9']
};

const FALLBACK_PALETTE = [
  ['#0ea5e9', '#0284c7', '#38bdf8'],
  ['#f43f5e', '#e11d48', '#fb7185'],
  ['#22c55e', '#16a34a', '#4ade80'],
  ['#a3a3a3', '#737373', '#d4d4d4'],
  ['#7c3aed', '#6d28d9', '#a78bfa'],
  ['#0d9488', '#0f766e', '#5eead4'],
  ['#c2410c', '#9a3412', '#fdba74'],
  ['#4f46e5', '#4338ca', '#818cf8']
];

function colorForType(group) {
  const preset = TYPE_COLORS[group];
  if (preset) return { background: preset[0], border: preset[1], highlight: preset[2] };

  // Deterministic so a type keeps its colour between renders and reloads.
  let hash = 0;
  const key = String(group || 'default');
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  const [background, border, highlight] = FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
  return { background, border, highlight };
}


/**
 * Render options, scaled to how big the graph is.
 *
 * A 77-node graph and an 870-node graph need different treatment: the settings
 * that make a small graph feel generous (big nodes, long springs, shadows,
 * every label drawn) turn a large one into an unreadable hairball.
 */
function buildOptions(nodeCount) {
  const large = nodeCount > 250;
  const huge = nodeCount > 600;

  return {
    nodes: {
      shape: 'dot',
      size: large ? 12 : 20,
      borderWidth: large ? 2 : 3,
      font: {
        size: 14,
        face: 'Inter',
        color: '#e2e8f0',
        strokeWidth: 3,
        strokeColor: 'rgba(11, 17, 32, 0.85)',
        // Labels are drawn in canvas space, so without a cap they grow without
        // limit as you zoom in - the reason text swallowed the screen.
        maxVisible: 20,
        // ...and below this on-screen size they are illegible clutter, so they
        // simply are not drawn when zoomed out.
        drawThreshold: large ? 10 : 6
      },
      shadow: large
        ? { enabled: false }
        : { enabled: true, color: 'rgba(0,0,0,0.4)', size: 8, x: 3, y: 3 },
      scaling: {
        min: large ? 6 : 15,
        max: large ? 26 : 30,
        // Node size tracks degree; font size must not, or hubs shout.
        label: { enabled: false }
      }
    },
    edges: {
      arrows: { to: { enabled: true, scaleFactor: large ? 0.45 : 0.8, type: 'arrow' } },
      color: {
        color: large ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.55)',
        highlight: '#818cf8',
        hover: '#a5b4fc'
      },
      font: {
        size: 11,
        align: 'middle',
        color: '#cbd5e1',
        strokeWidth: 3,
        strokeColor: 'rgba(11, 17, 32, 0.85)',
        maxVisible: 14,
        // Edge labels are the first thing to become noise; on a large graph
        // they only appear once you are zoomed well in.
        drawThreshold: large ? 14 : 8
      },
      smooth: large ? false : { type: 'continuous', roundness: 0.5 },
      width: large ? 1 : 2,
      scaling: { min: 1, max: large ? 3 : 5 },
      selectionWidth: 3
    },
    physics: {
      stabilization: { enabled: true, iterations: huge ? 120 : 200, fit: true },
      barnesHut: {
        // Far stronger repulsion and weaker centre pull on big graphs, so the
        // layout spreads out instead of collapsing into a ball.
        gravitationalConstant: huge ? -26000 : large ? -14000 : -3000,
        centralGravity: large ? 0.04 : 0.15,
        springLength: large ? 130 : 250,
        springConstant: large ? 0.02 : 0.05,
        damping: large ? 0.35 : 0.1,
        avoidOverlap: large ? 0.2 : 1
      },
      adaptiveTimestep: true
    },
    interaction: {
      // Hover runs hit-testing against every node on each mousemove, which is
      // a real cost past a few hundred nodes. Clicking still opens a node.
      hover: !large,
      tooltipDelay: 120,
      zoomView: true,
      dragView: true,
      hideEdgesOnDrag: large,
      hideNodesOnDrag: huge,
      selectConnectedEdges: !huge
    },
    layout: { improvedLayout: nodeCount <= 400 }
  };
}


/**
 * Freeze the simulation once the layout has settled.
 *
 * vis-network keeps the physics solver running after stabilisation, so every
 * pan and zoom re-solves forces for all nodes before it can redraw - which is
 * what makes a large graph feel like it is dragging. With physics off, zooming
 * is just a canvas transform and stays smooth. Small graphs keep physics on so
 * dragging a node still feels springy.
 */
function freezeWhenSettled(network, nodeCount) {
  if (nodeCount <= 250) return;
  const stop = () => {
    // The fallback timer can outlive the component; a destroyed network throws.
    try {
      network.setOptions({ physics: { enabled: false } });
    } catch (error) {
      /* network already destroyed - nothing to freeze */
    }
  };
  network.once('stabilizationIterationsDone', stop);
  // Stabilisation can finish without firing on an already-settled dataset, so
  // fall back to a timer rather than leaving the solver running forever.
  return setTimeout(stop, 6000);
}

const Graph = ({ nodes, edges, onNodeSelect, onGraphReady, onNodeFocus, focusId }) => {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const graphReadyCalled = useRef(false);
  const [labelMode, setLabelMode] = useState('auto');
  const freezeTimerRef = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const onNodeSelectRef = useRef(onNodeSelect);
  const onNodeFocusRef = useRef(onNodeFocus);
  
  // Keep callback ref up to date
  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
    onNodeFocusRef.current = onNodeFocus;
  }, [onNodeSelect, onNodeFocus]);

  const getNodeColor = useCallback((group) => colorForType(group), []);

  // Memoize the formatted data
  const formattedData = useMemo(() => {
    if (!nodes || !Array.isArray(nodes) || !edges || !Array.isArray(edges)) {
      return { nodes: [], edges: [] };
    }

    // Degree drives node size, so the hubs the insights engine cares about are
    // the ones that stand out visually.
    const degree = new Map();
    for (const edge of edges) {
      const from = typeof edge.from === 'object' ? edge.from?.id : edge.from;
      const to = typeof edge.to === 'object' ? edge.to?.id : edge.to;
      if (from) degree.set(String(from), (degree.get(String(from)) || 0) + 1);
      if (to) degree.set(String(to), (degree.get(String(to)) || 0) + 1);
    }

    // On a large graph, labelling every node produces solid text. Label only
    // the best-connected ones; the rest keep their hover tooltip and still
    // open in the inspector when clicked.
    const LABEL_BUDGET = 45;
    let labelCutoff = 0;
    if (labelMode === 'none') {
      labelCutoff = Infinity;
    } else if (labelMode === 'auto' && nodes.length > 250) {
      const sorted = [...degree.values()].sort((a, b) => b - a);
      labelCutoff = sorted[Math.min(LABEL_BUDGET, sorted.length - 1)] ?? 0;
    }

    return {
      nodes: nodes.map(node => {
        const colors = getNodeColor(node.group);
        const nodeDegree = degree.get(String(node.id)) || 0;
        return {
          id: node.id,
          label: node.id === focusId || nodeDegree >= labelCutoff ? node.label : undefined,
          group: node.group,
          value: nodeDegree + 1,
          title: `${node.label}\n${node.group}${node.year ? ` · ${node.year}` : ''}\n${nodeDegree} connection${nodeDegree === 1 ? '' : 's'}`,
          year: node.year,
          info: node.info,
          // The focused node is drawn larger with a light ring; nodes further
          // out are progressively faded so distance reads at a glance.
          borderWidth: node.id === focusId ? 5 : undefined,
          size: node.id === focusId ? 30 : undefined,
          opacity: node.hop >= 2 ? 0.55 : 1,
          color: {
            background: colors.background,
            border: node.id === focusId ? '#f8fafc' : colors.border,
            highlight: {
              background: colors.highlight,
              border: colors.border
            },
            hover: {
              background: colors.highlight,
              border: colors.border
            }
          },
          font: {
            color: '#ffffff',
            size: 14,
            face: 'Inter'
          },
          shadow: {
            enabled: true,
            color: 'rgba(0,0,0,0.3)',
            size: 5,
            x: 2,
            y: 2
          }
        };
      }),
      edges: edges.map(edge => ({
        id: edge.id,
        from: edge.from,
        to: edge.to,
        label: edge.label,
        arrows: {
          to: {
            enabled: true,
            scaleFactor: 0.8,
            type: 'arrow'
          }
        },
        width: Math.max(1, Math.min(5, (edge.weight || 1) * 2)),
        title: `${edge.label}${edge.weight ? ` (weight: ${edge.weight})` : ''}`,
        color: {
          color: 'rgba(148, 163, 184, 0.6)',
          highlight: 'rgba(99, 102, 241, 0.8)',
          hover: 'rgba(99, 102, 241, 0.8)'
        },
        font: {
          color: '#cbd5e1',
          size: 11,
          face: 'Inter',
          align: 'middle',
          strokeWidth: 2,
          strokeColor: 'rgba(15, 23, 42, 0.8)'
        },
        smooth: {
          type: 'continuous',
          roundness: 0.5
        },
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.2)',
          size: 3
        }
      }))
    };
  }, [nodes, edges, getNodeColor, labelMode, focusId]);

  // Check if data actually changed
  const dataChanged = useMemo(() => {
    const nodesChanged = JSON.stringify(nodesRef.current.map(n => n.id).sort()) !== 
                         JSON.stringify((nodes || []).map(n => n.id).sort());
    const edgesChanged = JSON.stringify(edgesRef.current.map(e => `${e.from}-${e.to}`).sort()) !== 
                         JSON.stringify((edges || []).map(e => `${e.from}-${e.to}`).sort());
    return nodesChanged || edgesChanged;
  }, [nodes, edges]);

  // Initialize network only once
  useEffect(() => {
    if (!containerRef.current) return;
    
    if (networkRef.current) return; // Already initialized

    // Safety checks
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return;
    }

    const options = buildOptions(formattedData.nodes.length);

    networkRef.current = new Network(containerRef.current, formattedData, options);
    freezeTimerRef.current = freezeWhenSettled(networkRef.current, formattedData.nodes.length);
    
    // Notify parent that graph is ready (only once)
    if (onGraphReady && !graphReadyCalled.current) {
      graphReadyCalled.current = true;
      setTimeout(() => {
        if (onGraphReady) {
          onGraphReady(networkRef.current);
        }
      }, 100);
    }

    // Handle node selection
    networkRef.current.on('selectNode', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const currentNodes = nodesRef.current;
        const node = currentNodes.find(n => n.id === nodeId);
        if (node && onNodeSelectRef.current) {
          onNodeSelectRef.current(node);
        }
      }
    });

    // Handle click on background to deselect
    networkRef.current.on('click', (params) => {
      if (params.nodes.length === 0 && onNodeSelectRef.current) {
        onNodeSelectRef.current(null);
      }
    });

    // Handle double-click to create edge (if needed)
    // Double-click re-centres the view on a node. (The previous handler here
    // tested for two selected nodes, which vis-network never reports.)
    networkRef.current.on('doubleClick', (params) => {
      if (params.nodes.length > 0 && onNodeFocusRef.current) {
        const node = nodesRef.current.find(n => n.id === params.nodes[0]);
        if (node) onNodeFocusRef.current(node);
      }
    });

    nodesRef.current = nodes || [];
    edgesRef.current = edges || [];

    return () => {
      clearTimeout(freezeTimerRef.current);
      if (networkRef.current) {
        networkRef.current.destroy();
        networkRef.current = null;
      }
      graphReadyCalled.current = false;
    };
  }, []); // Only run once on mount

  // Update data when it changes (without recreating network)
  useEffect(() => {
    if (!networkRef.current || !dataChanged) return;
    
    if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
      return;
    }

    // Re-apply options too: switching from a 77-node workspace to an 870-node
    // one needs a different layout, and setData alone would keep the old one.
    networkRef.current.setData(formattedData);
    // setData needs the solver running again to place the new nodes; freeze it
    // once that settles.
    networkRef.current.setOptions(buildOptions(formattedData.nodes.length));
    clearTimeout(freezeTimerRef.current);
    freezeTimerRef.current = freezeWhenSettled(networkRef.current, formattedData.nodes.length);
    nodesRef.current = nodes || [];
    edgesRef.current = edges || [];
  }, [formattedData, dataChanged, nodes, edges]);

  // Show message if no data
  if (!nodes || nodes.length === 0) {
    return (
      <div className="graph-container" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        color: 'var(--text-muted)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '10px' }}>No nodes to display</div>
          <div style={{ fontSize: '14px' }}>Check console for debugging info</div>
        </div>
      </div>
    );
  }

  const cycleLabels = () => {
    setLabelMode(m => (m === 'auto' ? 'all' : m === 'all' ? 'none' : 'auto'));
  };

  const fitView = () => networkRef.current?.fit({ animation: { duration: 400 } });

  /** Physics is frozen after settling, so offer an explicit way to re-run it. */
  const relayout = () => {
    const network = networkRef.current;
    if (!network) return;
    network.setOptions({ physics: { enabled: true } });
    network.stabilize();
    clearTimeout(freezeTimerRef.current);
    freezeTimerRef.current = freezeWhenSettled(network, nodes?.length || 0);
  };

  return (
    <div className="graph-wrap">
      <div ref={containerRef} className="graph-container" id="graph-canvas" />
      <div className="graph-controls">
        <button onClick={fitView} title="Zoom to fit the whole graph">⤢ Fit</button>
        <button onClick={relayout} title="Re-run the layout simulation">↻ Relayout</button>
        <button onClick={cycleLabels} title="Cycle label density">
          Labels: <strong>{labelMode}</strong>
        </button>
        <button onClick={() => networkRef.current?.moveTo({ scale: (networkRef.current.getScale() || 1) * 1.35, animation: true })} title="Zoom in">+</button>
        <button onClick={() => networkRef.current?.moveTo({ scale: (networkRef.current.getScale() || 1) / 1.35, animation: true })} title="Zoom out">−</button>
      </div>
    </div>
  );
};

export default Graph;

