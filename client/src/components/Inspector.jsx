import React, { useState, useEffect } from 'react';
import './Inspector.css';
import NodeEditor from './NodeEditor';
import { fetchConnections } from '../services/api';

const isUrl = (value) => typeof value === 'string' && /^https?:\/\//.test(value);

const Inspector = ({ selectedNode, workspace, onNodeUpdate, onStartStory, onClose, onFocus, isFocused, onOpenNode }) => {
  const [editing, setEditing] = useState(false);
  const [connections, setConnections] = useState([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const nodeId = selectedNode?.id;

  // Connections come from the server rather than from whatever the canvas
  // happens to have loaded, so the list is complete even in a focused view.
  useEffect(() => {
    if (!nodeId) return;
    let cancelled = false;
    setLoadingLinks(true);
    setConnections([]);
    setImageFailed(false);
    fetchConnections(workspace, nodeId)
      .then(data => { if (!cancelled) setConnections(data.connections || []); })
      .catch(() => { if (!cancelled) setConnections([]); })
      .finally(() => { if (!cancelled) setLoadingLinks(false); });
    return () => { cancelled = true; };
  }, [nodeId, workspace]);

  if (!selectedNode) return null;

  if (editing) {
    return (
      <div className="inspector">
        <NodeEditor
          node={selectedNode}
          workspace={workspace}
          onSave={() => { setEditing(false); onNodeUpdate?.(); }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const metadata = selectedNode.metadata || {};
  const image = metadata.image;
  const metaEntries = Object.entries(metadata)
    .filter(([key, v]) => key !== 'image' && v !== undefined && v !== null && v !== '');

  // Group by relation so "developed by x3" reads as one idea, not three rows.
  const grouped = connections.reduce((acc, c) => {
    const key = `${c.direction}:${c.relation}`;
    (acc[key] = acc[key] || { relation: c.relation, direction: c.direction, items: [] }).items.push(c);
    return acc;
  }, {});

  return (
    <article className="inspector">
      <header className="ins-head">
        <span className="ins-kicker">{selectedNode.group}</span>
        <button className="ins-close" onClick={onClose} aria-label="Close">×</button>
      </header>

      {image && !imageFailed && (
        <img
          className="ins-image"
          src={image}
          alt={selectedNode.label}
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      )}

      <h2 className="ins-title">{selectedNode.label}</h2>
      {selectedNode.year != null && <div className="ins-year">{selectedNode.year}</div>}
      {selectedNode.info && <p className="ins-info">{selectedNode.info}</p>}

      <div className="ins-block">
        <h3>
          Connections
          {!loadingLinks && <span className="ins-count">{connections.length}</span>}
        </h3>

        {loadingLinks ? (
          <p className="ins-muted">Loading…</p>
        ) : connections.length === 0 ? (
          <p className="ins-muted">Nothing links to this node yet.</p>
        ) : (
          <div className="ins-rels">
            {Object.values(grouped).map(group => (
              <div key={`${group.direction}:${group.relation}`} className="ins-rel">
                <div className="ins-rel-head">
                  <span className={`ins-arrow ${group.direction}`} aria-hidden="true">
                    {group.direction === 'out' ? '→' : '←'}
                  </span>
                  {group.relation}
                </div>
                <ul>
                  {group.items.map(item => (
                    <li key={item.id}>
                      <button onClick={() => onOpenNode?.(item)}>
                        {item.image && (
                          <img src={item.image} alt="" loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
                        )}
                        <span className="ins-link-label">{item.label}</span>
                        <span className="ins-link-group">{item.group}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedNode.tags?.length > 0 && (
        <div className="ins-block">
          <h3>Tags</h3>
          <div className="ins-tags">
            {selectedNode.tags.map((tag, i) => <span key={i} className="ins-tag">{tag}</span>)}
          </div>
        </div>
      )}

      {metaEntries.length > 0 && (
        <details className="ins-block ins-meta-block">
          <summary>Metadata</summary>
          <dl className="ins-meta">
            {metaEntries.map(([key, value]) => (
              <div key={key} className="ins-meta-row">
                <dt>{key}</dt>
                <dd>
                  {isUrl(value)
                    ? <a href={value} target="_blank" rel="noopener noreferrer">{String(value).replace(/^https?:\/\//, '')}</a>
                    : String(value)}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      )}

      <div className="ins-actions">
        {onFocus && (
          <button className="ins-btn" onClick={onFocus} disabled={isFocused}>
            {isFocused ? 'Focused' : 'Focus here'}
          </button>
        )}
        <button className="ins-btn ins-btn-ghost" onClick={() => setEditing(true)}>Edit</button>
        {onStartStory && (
          <button className="ins-btn ins-btn-ghost" onClick={() => onStartStory(selectedNode)}>Story</button>
        )}
      </div>
    </article>
  );
};

export default Inspector;
