import React, { useEffect, useRef, useMemo, useCallback } from 'react';
import { Network } from 'vis-network';
import './Graph.css';

const Graph = ({ nodes, edges, onNodeSelect, onGraphReady }) => {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const graphReadyCalled = useRef(false);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const onNodeSelectRef = useRef(onNodeSelect);
  
  // Keep callback ref up to date
  useEffect(() => {
    onNodeSelectRef.current = onNodeSelect;
  }, [onNodeSelect]);

  // Color mapping for node types
  const typeColors = {
    'Person': { background: '#6366f1', border: '#4f46e5', highlight: '#818cf8' },
    'Organization': { background: '#8b5cf6', border: '#7c3aed', highlight: '#a78bfa' },
    'Idea': { background: '#ec4899', border: '#db2777', highlight: '#f472b6' },
    'Paper': { background: '#10b981', border: '#059669', highlight: '#34d399' },
    'Event': { background: '#f59e0b', border: '#d97706', highlight: '#fbbf24' },
    'default': { background: '#64748b', border: '#475569', highlight: '#94a3b8' }
  };

  const getNodeColor = useCallback((group) => {
    return typeColors[group] || typeColors['default'];
  }, []);

  // Memoize the formatted data
  const formattedData = useMemo(() => {
    if (!nodes || !Array.isArray(nodes) || !edges || !Array.isArray(edges)) {
      return { nodes: [], edges: [] };
    }

    return {
      nodes: nodes.map(node => {
        const colors = getNodeColor(node.group);
        return {
          id: node.id,
          label: node.label,
          group: node.group,
          title: `${node.label}\n${node.group}${node.year ? ` (${node.year})` : ''}`,
          year: node.year,
          info: node.info,
          color: {
            background: colors.background,
            border: colors.border,
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
  }, [nodes, edges, getNodeColor]);

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

    const options = {
      nodes: {
        shape: 'dot',
        size: 20,
        font: {
          size: 14,
          face: 'Inter'
        },
        borderWidth: 3,
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.4)',
          size: 8,
          x: 3,
          y: 3
        },
        scaling: {
          min: 15,
          max: 30
        }
      },
      edges: {
        arrows: {
          to: {
            enabled: true,
            scaleFactor: 0.8,
            type: 'arrow'
          }
        },
        font: {
          size: 11,
          align: 'middle',
          strokeWidth: 2,
          strokeColor: 'rgba(15, 23, 42, 0.8)'
        },
        smooth: {
          type: 'continuous',
          roundness: 0.5
        },
        width: 2,
        scaling: {
          min: 1,
          max: 5
        },
        selectionWidth: 4
      },
      physics: {
        stabilization: {
          enabled: true,
          iterations: 200,
          fit: true
        },
        barnesHut: {
          gravitationalConstant: -3000,
          centralGravity: 0.15,
          springLength: 250,
          springConstant: 0.05,
          damping: 0.1,
          avoidOverlap: 1
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        zoomView: true,
        dragView: true,
        selectConnectedEdges: true
      },
      layout: {
        improvedLayout: true
      }
    };

    networkRef.current = new Network(containerRef.current, formattedData, options);
    
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
    networkRef.current.on('doubleClick', (params) => {
      if (params.nodes.length === 2) {
        console.log('Double-clicked two nodes:', params.nodes);
      }
    });

    nodesRef.current = nodes || [];
    edgesRef.current = edges || [];

    return () => {
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

    // Update data using setData instead of recreating
    networkRef.current.setData(formattedData);
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

  return <div ref={containerRef} className="graph-container" id="graph-canvas" />;
};

export default Graph;

