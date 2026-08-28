import React, { useState, useEffect } from 'react';
import './Sidebar.css';
import ImportExport from './ImportExport';
import WebIngest from './WebIngest';
import NodeEditor from './NodeEditor';
import EdgeEditor from './EdgeEditor';
import GraphExporter from './GraphExporter';

/** A collapsible panel section. Sections remember their own open state. */
const Section = ({ title, badge, defaultOpen = true, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`panel ${open ? 'is-open' : ''}`}>
      <button className="panel-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <span className="panel-chevron" aria-hidden="true">▸</span>
        <span className="panel-title">{title}</span>
        {badge != null && <span className="panel-badge">{badge}</span>}
      </button>
      {open && <div className="panel-body">{children}</div>}
    </section>
  );
};

const Sidebar = ({ filters, onFilterChange, nodeCount, totalCount, availableTypes, stats, onDataChange, graphContainerRef }) => {
  const [selectedTypes, setSelectedTypes] = useState(filters.types || []);
  const [maxYearValue, setMaxYearValue] = useState(filters.maxYear || '');
  const [minYearValue, setMinYearValue] = useState(filters.minYear || '');
  const [showNodeEditor, setShowNodeEditor] = useState(false);
  const [showEdgeEditor, setShowEdgeEditor] = useState(false);

  const workspaceValue = filters.workspace || 'default';

  useEffect(() => {
    setSelectedTypes(filters.types || []);
    setMaxYearValue(filters.maxYear || '');
    setMinYearValue(filters.minYear || '');
  }, [filters]);

  const handleTypeToggle = (type) => {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter(t => t !== type)
      : [...selectedTypes, type];
    setSelectedTypes(next);
    onFilterChange({ ...filters, types: next });
  };

  const clearTypes = () => {
    setSelectedTypes([]);
    onFilterChange({ ...filters, types: [] });
  };

  const handleYear = (which) => (e) => {
    const raw = e.target.value;
    const value = raw === '' ? null : parseInt(raw, 10);
    if (which === 'min') setMinYearValue(raw); else setMaxYearValue(raw);
    onFilterChange({ ...filters, [which === 'min' ? 'minYear' : 'maxYear']: value });
  };

  const clearYears = () => {
    setMinYearValue('');
    setMaxYearValue('');
    onFilterChange({ ...filters, minYear: null, maxYear: null });
  };

  const yearsActive = minYearValue !== '' || maxYearValue !== '';

  return (
    <div className="sidebar">
      {showNodeEditor && (
        <div className="editor-overlay">
          <NodeEditor
            workspace={workspaceValue}
            onSave={() => { setShowNodeEditor(false); onDataChange?.(); }}
            onCancel={() => setShowNodeEditor(false)}
          />
        </div>
      )}
      {showEdgeEditor && (
        <div className="editor-overlay">
          <EdgeEditor
            workspace={workspaceValue}
            nodes={[]}
            onSave={() => { setShowEdgeEditor(false); onDataChange?.(); }}
            onCancel={() => setShowEdgeEditor(false)}
          />
        </div>
      )}

      <div className="sidebar-actions">
        <button className="act act-primary" onClick={() => setShowNodeEditor(true)}>
          <span aria-hidden="true">＋</span> Node
        </button>
        <button className="act" onClick={() => setShowEdgeEditor(true)}>
          <span aria-hidden="true">⇄</span> Connection
        </button>
      </div>

      <Section title="Pull from the web" defaultOpen>
        <WebIngest workspace={workspaceValue} onIngestComplete={onDataChange} />
      </Section>

      <Section
        title="Entity types"
        badge={selectedTypes.length ? `${selectedTypes.length}/${availableTypes.length}` : availableTypes.length || null}
      >
        {availableTypes.length > 0 ? (
          <>
            <div className="chips">
              {availableTypes.map(type => (
                <button
                  key={type}
                  className={`chip ${selectedTypes.includes(type) ? 'is-on' : ''}`}
                  onClick={() => handleTypeToggle(type)}
                >
                  {type}
                </button>
              ))}
            </div>
            {selectedTypes.length > 0 && (
              <button className="link-btn" onClick={clearTypes}>Show all types</button>
            )}
          </>
        ) : (
          <p className="panel-empty">No types in this workspace yet.</p>
        )}
      </Section>

      <Section title="Timeline" badge={yearsActive ? 'on' : null} defaultOpen={false}>
        <div className="year-row">
          <label>
            <span>From</span>
            <input type="number" value={minYearValue} onChange={handleYear('min')} placeholder="any" />
          </label>
          <label>
            <span>To</span>
            <input type="number" value={maxYearValue} onChange={handleYear('max')} placeholder="any" />
          </label>
        </div>
        <p className="panel-note">Entities without a date stay visible.</p>
        {yearsActive && <button className="link-btn" onClick={clearYears}>Clear timeline</button>}
      </Section>

      {stats && (
        <Section title="Workspace stats" defaultOpen={false}>
          <div className="stat-grid">
            <div><strong>{stats.nodeCount}</strong><span>nodes</span></div>
            <div><strong>{stats.edgeCount}</strong><span>edges</span></div>
            <div><strong>{stats.avgDegree}</strong><span>avg degree</span></div>
          </div>
        </Section>
      )}

      <Section title="Import & export" defaultOpen={false}>
        <ImportExport workspace={workspaceValue} onImportComplete={onDataChange} />
        <GraphExporter graphContainerRef={graphContainerRef} graphName={workspaceValue} />
      </Section>

      <footer className="sidebar-foot">
        Showing {nodeCount} of {totalCount || nodeCount} entities
      </footer>
    </div>
  );
};

export default Sidebar;
