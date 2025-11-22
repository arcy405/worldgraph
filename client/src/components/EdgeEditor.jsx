import React, { useState, useEffect } from 'react';
import { createEdge, updateEdge, deleteEdge, fetchNode } from '../services/api';
import './EdgeEditor.css';

const EdgeEditor = ({ edge, fromNodeId, toNodeId, nodes: propNodes, workspace, onSave, onCancel, onDelete }) => {
  const [formData, setFormData] = useState({
    from: '',
    to: '',
    label: '',
    weight: 1
  });
  const [fromNode, setFromNode] = useState(null);
  const [toNode, setToNode] = useState(null);
  const [nodes, setNodes] = useState(propNodes || []);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loadingNodes, setLoadingNodes] = useState(false);

  useEffect(() => {
    // Load nodes if not provided
    if (!propNodes || propNodes.length === 0) {
      setLoadingNodes(true);
      fetchAllNodes(workspace).then(loadedNodes => {
        setNodes(loadedNodes);
        setLoadingNodes(false);
      }).catch(() => setLoadingNodes(false));
    }

    if (edge) {
      setFormData({
        from: edge.from?.id || edge.from || '',
        to: edge.to?.id || edge.to || '',
        label: edge.label || '',
        weight: edge.weight || 1
      });
      if (edge.from?.id) fetchNode(edge.from.id).then(setFromNode);
      if (edge.to?.id) fetchNode(edge.to.id).then(setToNode);
    } else if (fromNodeId && toNodeId) {
      setFormData(prev => ({
        ...prev,
        from: fromNodeId,
        to: toNodeId
      }));
      fetchNode(fromNodeId).then(setFromNode);
      fetchNode(toNodeId).then(setToNode);
    }
  }, [edge, fromNodeId, toNodeId, workspace, propNodes]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNodeSelect = async (field, nodeId) => {
    setFormData(prev => ({ ...prev, [field]: nodeId }));
    const node = await fetchNode(nodeId);
    if (field === 'from') setFromNode(node);
    else setToNode(node);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const edgeData = {
        from: formData.from,
        to: formData.to,
        label: formData.label.trim(),
        weight: parseFloat(formData.weight) || 1,
        workspace
      };

      if (edge) {
        await updateEdge(edge.id, edgeData);
      } else {
        await createEdge(edgeData);
      }

      if (onSave) onSave();
    } catch (err) {
      setError(err.message || 'Failed to save edge');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!edge || !window.confirm(`Delete this connection?`)) return;

    try {
      await deleteEdge(edge.id);
      if (onDelete) onDelete();
    } catch (err) {
      setError(err.message || 'Failed to delete edge');
    }
  };

  return (
    <div className="edge-editor">
      <div className="edge-editor-header">
        <h3>{edge ? 'Edit Connection' : 'Create New Connection'}</h3>
        {onCancel && (
          <button className="close-btn" onClick={onCancel}>✕</button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="edge-editor-form">
        <div className="form-group">
          <label>From Node *</label>
          {fromNode ? (
            <div className="node-preview">
              <span>{fromNode.label}</span>
              <button type="button" onClick={() => { setFromNode(null); setFormData(prev => ({ ...prev, from: '' })); }}>
                Change
              </button>
            </div>
          ) : (
            <select
              name="from"
              value={formData.from}
              onChange={(e) => handleNodeSelect('from', e.target.value)}
              required
            >
              <option value="">Select node...</option>
              {nodes.map(node => (
                <option key={node.id} value={node.id}>{node.label} ({node.group})</option>
              ))}
            </select>
          )}
        </div>

        <div className="form-group">
          <label>To Node *</label>
          {toNode ? (
            <div className="node-preview">
              <span>{toNode.label}</span>
              <button type="button" onClick={() => { setToNode(null); setFormData(prev => ({ ...prev, to: '' })); }}>
                Change
              </button>
            </div>
          ) : (
            <select
              name="to"
              value={formData.to}
              onChange={(e) => handleNodeSelect('to', e.target.value)}
              required
            >
              <option value="">Select node...</option>
              {nodes.map(node => (
                <option key={node.id} value={node.id}>{node.label} ({node.group})</option>
              ))}
            </select>
          )}
        </div>

        <div className="form-group">
          <label>Relationship *</label>
          <input
            type="text"
            name="label"
            value={formData.label}
            onChange={handleChange}
            required
            placeholder="e.g., authored, influenced, collaborated_with"
            list="relationship-types"
          />
          <datalist id="relationship-types">
            <option value="authored" />
            <option value="influenced" />
            <option value="collaborated_with" />
            <option value="founded" />
            <option value="works_at" />
            <option value="related_to" />
            <option value="enabled" />
            <option value="preceded" />
            <option value="inspired" />
            <option value="developed" />
          </datalist>
        </div>

        <div className="form-group">
          <label>Weight (1-10)</label>
          <input
            type="number"
            name="weight"
            value={formData.weight}
            onChange={handleChange}
            min="1"
            max="10"
            step="0.1"
          />
          <small>Higher weight = stronger relationship</small>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="form-actions">
          <button type="submit" disabled={saving} className="save-btn">
            {saving ? 'Saving...' : (edge ? 'Update' : 'Create')}
          </button>
          {edge && (
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

export default EdgeEditor;

