import React, { useState, useEffect } from 'react';
import './TopBar.css';
import { fetchWorkspaces, findNodes } from '../services/api';

const NEW_WORKSPACE = '__new_workspace__';

/**
 * The app's single global control strip. Workspace, search and the live counts
 * are the highest-level controls, so they sit above the canvas rather than
 * buried in a panel.
 */
const TopBar = ({ filters, onFilterChange, stats, nodeCount, edgeCount, refreshKey, showInsights, onToggleInsights, onFocusNode }) => {
  const [workspaces, setWorkspaces] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState([]);
  const [open, setOpen] = useState(false);



  useEffect(() => {
    let cancelled = false;
    fetchWorkspaces().then(list => { if (!cancelled && list.length) setWorkspaces(list); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  // Searching locates nodes; it does not filter the graph. Replacing the whole
  // view with the search results threw away the context you were reading.
  const handleSearch = (e) => {
    const value = e.target.value;
    setSearch(value);
    clearTimeout(window.__wgSearchTimer);
    if (!value.trim()) {
      setMatches([]);
      setOpen(false);
      return;
    }
    window.__wgSearchTimer = setTimeout(async () => {
      const found = await findNodes(filters.workspace, value);
      setMatches(found);
      setOpen(found.length > 0);
    }, 250);
  };

  const pick = (match) => {
    setOpen(false);
    setSearch('');
    setMatches([]);
    onFocusNode?.(match);
  };

  const selectWorkspace = (name) => onFilterChange({ ...filters, workspace: name });

  const handleWorkspace = (e) => {
    if (e.target.value === NEW_WORKSPACE) {
      setNewName('');
      setCreating(true);
      return;
    }
    selectWorkspace(e.target.value);
  };

  const commit = () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(false);
    selectWorkspace(name);
  };

  const current = filters.workspace || 'default';
  const options = workspaces.some(w => w.name === current)
    ? workspaces
    : [...workspaces, { name: current, nodeCount: 0 }];

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="topbar-mark" aria-hidden="true">◈</span>
        <span className="topbar-name">WorldGraph</span>
      </div>

      <div className="topbar-search">
        <span className="topbar-search-icon" aria-hidden="true">⌕</span>
        <input
          type="text"
          value={search}
          onChange={handleSearch}
          placeholder="Find an entity…"
          aria-label="Find an entity"
          onFocus={() => matches.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 160)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches[0]) pick(matches[0]);
            if (e.key === 'Escape') setOpen(false);
          }}
        />
        {search && (
          <button className="topbar-search-clear" onClick={() => { setSearch(''); setMatches([]); setOpen(false); }} aria-label="Clear search">×</button>
        )}
        {open && (
          <ul className="topbar-results">
            {matches.map(m => (
              <li key={m.id}>
                <button onMouseDown={() => pick(m)}>
                  <span className="topbar-result-label">{m.label}</span>
                  <span className="topbar-result-meta">{m.group}{m.year ? ` · ${m.year}` : ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="topbar-right">
        <div className="topbar-counts" title="Nodes and edges currently shown">
          <span><strong>{nodeCount ?? 0}</strong> nodes</span>
          <span className="topbar-dot" aria-hidden="true">·</span>
          <span><strong>{edgeCount ?? 0}</strong> edges</span>
          {stats?.types != null && (
            <>
              <span className="topbar-dot" aria-hidden="true">·</span>
              <span><strong>{stats.types}</strong> types</span>
            </>
          )}
        </div>

        {creating ? (
          <div className="topbar-newspace">
            <input
              autoFocus
              value={newName}
              placeholder="new-workspace"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setCreating(false);
              }}
            />
            <button onClick={commit} disabled={!newName.trim()}>Use</button>
            <button className="ghost" onClick={() => setCreating(false)}>×</button>
          </div>
        ) : (
          <label className="topbar-workspace">
            <span className="topbar-workspace-dot" aria-hidden="true" />
            <select value={current} onChange={handleWorkspace} aria-label="Workspace">
              {options.map(w => (
                <option key={w.name} value={w.name}>
                  {w.name}{w.nodeCount > 0 ? ` · ${w.nodeCount}` : ' · empty'}
                </option>
              ))}
              <option value={NEW_WORKSPACE}>+ New workspace…</option>
            </select>
          </label>
        )}

        <button
          className={`topbar-insights ${showInsights ? 'is-on' : ''}`}
          onClick={onToggleInsights}
          title="Toggle the insights panel"
        >
          Insights
        </button>
      </div>
    </header>
  );
};

export default TopBar;
