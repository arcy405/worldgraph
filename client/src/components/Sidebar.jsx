import React, { useState, useEffect } from 'react';
import './Sidebar.css';
import ImportExport from './ImportExport';
import NodeEditor from './NodeEditor';
import EdgeEditor from './EdgeEditor';
import GraphExporter from './GraphExporter';

const Sidebar = ({ filters, onFilterChange, nodeCount, totalCount, availableTypes, stats, onDataChange, graphContainerRef }) => {
  const [searchValue, setSearchValue] = useState(filters.search || '');
  const [selectedTypes, setSelectedTypes] = useState(filters.types || []);
  const [maxYearValue, setMaxYearValue] = useState(filters.maxYear || stats?.yearRange?.maxYear || 2025);
  const [minYearValue, setMinYearValue] = useState(filters.minYear || stats?.yearRange?.minYear || 2000);
  const [workspaceValue, setWorkspaceValue] = useState(filters.workspace || 'default');
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [showEdgeEditor, setShowEdgeEditor] = useState(false);

  useEffect(() => {
    setSearchValue(filters.search || '');
    setSelectedTypes(filters.types || []);
    setMaxYearValue(filters.maxYear || stats?.yearRange?.maxYear || 2025);
    setMinYearValue(filters.minYear || stats?.yearRange?.minYear || 2000);
    setWorkspaceValue(filters.workspace || 'default');
  }, [filters, stats]);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchValue(value);
    // Debounce search
    clearTimeout(window.searchTimeout);
    window.searchTimeout = setTimeout(() => {
      onFilterChange({ ...filters, search: value });
    }, 300);
  };

  const handleTypeToggle = (type) => {
    const newTypes = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    
    setSelectedTypes(newTypes);
    onFilterChange({ ...filters, types: newTypes });
  };

  const handleMaxYearChange = (e) => {
    const value = parseInt(e.target.value) || null;
    setMaxYearValue(value);
    onFilterChange({ ...filters, maxYear: value });
  };

  const handleMinYearChange = (e) => {
    const value = parseInt(e.target.value) || null;
    setMinYearValue(value);
    onFilterChange({ ...filters, minYear: value });
  };

  const handleWorkspaceChange = (e) => {
    const value = e.target.value;
    setWorkspaceValue(value);
    onFilterChange({ ...filters, workspace: value });
  };

  const minYear = stats?.yearRange?.minYear || 2000;
  const maxYear = stats?.yearRange?.maxYear || 2025;

  const handleNodeEditorSave = () => {
    setShowNodeEditor(false);
    if (onDataChange) onDataChange();
  };

  const handleEdgeEditorSave = () => {
    setShowEdgeEditor(false);
    if (onDataChange) onDataChange();
  };

  return (
    <div className="sidebar">
      <h2>WorldGraph 🌐</h2>
      
      <div className="quick-actions">
        <button 
          className="action-btn primary"
          onClick={() => setShowNodeEditor(true)}
          title="Create new node"
        >
          ➕ Add Node
        </button>
        <button 
          className="action-btn secondary"
          onClick={() => setShowEdgeEditor(true)}
          title="Create new connection"
        >
          🔗 Add Connection
        </button>
      </div>

      {showNodeEditor && (
        <div className="editor-overlay">
          <NodeEditor
            workspace={workspaceValue}
            onSave={handleNodeEditorSave}
            onCancel={() => setShowNodeEditor(false)}
          />
        </div>
      )}

      {showEdgeEditor && (
        <div className="editor-overlay">
          <EdgeEditor
            workspace={workspaceValue}
            nodes={[]}
            onSave={handleEdgeEditorSave}
            onCancel={() => setShowEdgeEditor(false)}
          />
        </div>
      )}
      
      <div className="filters">
        <label>
          <strong>Workspace:</strong>
          <input
            type="text"
            value={workspaceValue}
            onChange={handleWorkspaceChange}
            placeholder="default"
            style={{ width: '100%', marginTop: '5px' }}
          />
        </label>
      </div>

      <input
        type="text"
        id="searchInput"
        placeholder="Search entities..."
        value={searchValue}
        onChange={handleSearchChange}
      />
      
      <div className="filters">
        <strong>Filter by Type</strong>
        <br />
        {availableTypes.length > 0 ? (
          availableTypes.map(type => (
            <label key={type}>
              <input
                type="checkbox"
                className="typeFilter"
                value={type}
                checked={selectedTypes.includes(type)}
                onChange={() => handleTypeToggle(type)}
              />
              {' '}{type}
            </label>
          ))
        ) : (
          <div style={{ fontSize: '0.9em', color: '#666' }}>No types available</div>
        )}
      </div>

      <div className="filters">
        <strong>Timeline</strong>
        <br />
        <label>
          Min Year: <input
            type="number"
            value={minYearValue || ''}
            onChange={handleMinYearChange}
            min={minYear}
            max={maxYear}
            style={{ width: '80px' }}
            placeholder="Any"
          />
        </label>
        <br />
        <label>
          Max Year: <input
            type="number"
            value={maxYearValue || ''}
            onChange={handleMaxYearChange}
            min={minYear}
            max={maxYear}
            style={{ width: '80px' }}
            placeholder="Any"
          />
        </label>
      </div>

      {stats && (
        <div className="filters" style={{ fontSize: '0.85em', color: '#666' }}>
          <strong>Statistics</strong>
          <div>Nodes: {stats.nodeCount}</div>
          <div>Edges: {stats.edgeCount}</div>
          <div>Avg Degree: {stats.avgDegree}</div>
        </div>
      )}

      <ImportExport workspace={workspaceValue} onImportComplete={() => window.location.reload()} />
      
      <GraphExporter graphContainerRef={graphContainerRef} graphName={workspaceValue} />

      <footer>
        Showing <span id="nodeCount">{nodeCount}</span> of {totalCount || nodeCount} entities
      </footer>
    </div>
  );
};

export default Sidebar;

