import React, { useState, useEffect } from 'react';
import { createNode, updateNode, deleteNode } from '../services/api';
import './NodeEditor.css';

const NodeEditor = ({ node, workspace, onSave, onCancel, onDelete }) => {
  const [formData, setFormData] = useState({
    label: '',
    group: '',
    year: '',
    info: '',
    tags: '',
    metadata: {}
  });
  const [metadataKey, setMetadataKey] = useState('');
  const [metadataValue, setMetadataValue] = useState('');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (node) {
      setFormData({
        label: node.label || '',
        group: node.group || '',
        year: node.year || '',
        info: node.info || '',
        tags: (node.tags || []).join(', '),
        metadata: node.metadata || {}
      });
    }
  }, [node]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddMetadata = () => {
    if (metadataKey && metadataValue) {
      setFormData(prev => ({
        ...prev,
        metadata: { ...prev.metadata, [metadataKey]: metadataValue }
      }));
      setMetadataKey('');
      setMetadataValue('');
    }
  };

  const handleRemoveMetadata = (key) => {
    setFormData(prev => {
      const newMetadata = { ...prev.metadata };
      delete newMetadata[key];
      return { ...prev, metadata: newMetadata };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const nodeData = {
        label: formData.label.trim(),
        group: formData.group.trim(),
        year: formData.year ? parseInt(formData.year) : null,
        info: formData.info.trim(),
        tags: formData.tags.split(',').map(t => t.trim()).filter(t => t),
        metadata: formData.metadata,
        workspace
      };

      if (node) {
        await updateNode(node.id, nodeData);
      } else {
        await createNode(nodeData);
      }

      if (onSave) onSave();
    } catch (err) {
      setError(err.message || 'Failed to save node');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!node || !window.confirm(`Delete "${node.label}"?`)) return;

    try {
      await deleteNode(node.id);
      if (onDelete) onDelete();
    } catch (err) {
      setError(err.message || 'Failed to delete node');
    }
  };

  return (
    <div className="node-editor">
      <div className="node-editor-header">
        <h3>{node ? 'Edit Node' : 'Create New Node'}</h3>
        {onCancel && (
          <button className="close-btn" onClick={onCancel}>✕</button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="node-editor-form">
        <div className="form-group">
          <label>Label *</label>
          <input
            type="text"
            name="label"
            value={formData.label}
            onChange={handleChange}
            required
            placeholder="Node name"
          />
        </div>

        <div className="form-group">
          <label>Type *</label>
          <input
            type="text"
            name="group"
            value={formData.group}
            onChange={handleChange}
            required
            placeholder="Person, Organization, Idea, Paper, Event..."
            list="node-types"
          />
          <datalist id="node-types">
            <option value="Person" />
            <option value="Organization" />
            <option value="Idea" />
            <option value="Paper" />
            <option value="Event" />
            <option value="Place" />
            <option value="Concept" />
            <option value="Technology" />
          </datalist>
        </div>

        <div className="form-group">
          <label>Year</label>
          <input
            type="number"
            name="year"
            value={formData.year}
            onChange={handleChange}
            placeholder="e.g., 2023"
          />
        </div>

        <div className="form-group">
          <label>Description *</label>
          <textarea
            name="info"
            value={formData.info}
            onChange={handleChange}
            required
            rows={3}
            placeholder="Description of this node..."
          />
        </div>

        <div className="form-group">
          <label>Tags (comma-separated)</label>
          <input
            type="text"
            name="tags"
            value={formData.tags}
            onChange={handleChange}
            placeholder="AI, Research, Technology"
          />
        </div>

        <div className="form-group">
          <label>Custom Metadata</label>
          <div className="metadata-input">
            <input
              type="text"
              placeholder="Key"
              value={metadataKey}
              onChange={(e) => setMetadataKey(e.target.value)}
            />
            <input
              type="text"
              placeholder="Value"
              value={metadataValue}
              onChange={(e) => setMetadataValue(e.target.value)}
            />
            <button type="button" onClick={handleAddMetadata}>Add</button>
          </div>
          {Object.keys(formData.metadata).length > 0 && (
            <div className="metadata-list">
              {Object.entries(formData.metadata).map(([key, value]) => (
                <div key={key} className="metadata-item">
                  <span><strong>{key}:</strong> {value}</span>
                  <button type="button" onClick={() => handleRemoveMetadata(key)}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="form-actions">
          <button type="submit" disabled={saving} className="save-btn">
            {saving ? 'Saving...' : (node ? 'Update' : 'Create')}
          </button>
          {node && (
            <button type="button" onClick={handleDelete} className="delete-btn">
              Delete
            </button>
          )}
          {onCancel && (
            <button type="button" onClick={onCancel} className="cancel-btn">
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default NodeEditor;

