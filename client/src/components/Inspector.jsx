import React, { useState } from 'react';
import './Inspector.css';
import NodeEditor from './NodeEditor';

const Inspector = ({ selectedNode, workspace, onNodeUpdate, onStartStory }) => {
  const [editing, setEditing] = useState(false);

  if (!selectedNode) {
    return (
      <div className="inspector">
        <h3>Entity Info</h3>
        <div className="info" style={{ 
          textAlign: 'center', 
          padding: '40px 20px',
          color: 'var(--text-muted)',
          fontStyle: 'italic'
        }}>
          Click a node to see details
        </div>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="inspector">
        <NodeEditor
          node={selectedNode}
          workspace={workspace}
          onSave={() => {
            setEditing(false);
            if (onNodeUpdate) onNodeUpdate();
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="inspector">
      <div className="inspector-header">
        <h3>Entity Info</h3>
        <div className="inspector-actions">
          {onStartStory && (
            <button className="story-btn" onClick={() => onStartStory(selectedNode)} title="Start story from this node">
              📖 Story
            </button>
          )}
          <button className="edit-btn" onClick={() => setEditing(true)} title="Edit node">
            ✏️
          </button>
        </div>
      </div>
      <div className="info">
        <strong>{selectedNode.label}</strong>
        <br />
        <span className="node-meta">
          {selectedNode.group}
          {selectedNode.year && `, ${selectedNode.year}`}
        </span>
        <br />
        <p>{selectedNode.info}</p>
        
        {selectedNode.tags && selectedNode.tags.length > 0 && (
          <div className="tags-section">
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>Tags:</strong>
            <div className="tags-container">
              {selectedNode.tags.map((tag, idx) => (
                <span key={idx} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {selectedNode.metadata && Object.keys(selectedNode.metadata).length > 0 && (
          <div className="metadata-section">
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>Metadata:</strong>
            <div className="metadata-container">
              {Object.entries(selectedNode.metadata).map(([key, value]) => (
                <div key={key} className="metadata-item">
                  <span className="metadata-key">{key}:</span>
                  <span className="metadata-value">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Inspector;

