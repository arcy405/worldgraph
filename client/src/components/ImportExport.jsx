import React, { useState } from 'react';
import { importData, exportData } from '../services/api';
import './ImportExport.css';

const ImportExport = ({ workspace, onImportComplete }) => {
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [jsonInput, setJsonInput] = useState('');

  const handleImportJSON = async () => {
    if (!jsonInput.trim()) {
      setError('Please paste JSON data');
      return;
    }

    setImporting(true);
    setError(null);
    setSuccess(null);

    try {
      const data = JSON.parse(jsonInput);
      const result = await importData(data, workspace);
      setSuccess(`Imported ${result.nodesImported} nodes and ${result.edgesImported} edges`);
      setJsonInput('');
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (err) {
      setError(err.message || 'Invalid JSON format');
    } finally {
      setImporting(false);
    }
  };

  const handleExportJSON = async () => {
    setExporting(true);
    setError(null);
    setSuccess(null);

    try {
      const data = await exportData(workspace, 'json');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `worldgraph-${workspace}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess('Export completed');
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    setError(null);
    setSuccess(null);

    try {
      const blob = await exportData(workspace, 'csv');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `worldgraph-${workspace}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess('Export completed');
    } catch (err) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="import-export">
      <h3>Import / Export</h3>
      
      <div className="import-section">
        <h4>Import JSON</h4>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder='{"nodes": [...], "edges": [...]}'
          rows={6}
        />
        <button onClick={handleImportJSON} disabled={importing}>
          {importing ? 'Importing...' : 'Import JSON'}
        </button>
      </div>

      <div className="export-section">
        <h4>Export</h4>
        <button onClick={handleExportJSON} disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export JSON'}
        </button>
        <button onClick={handleExportCSV} disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export CSV'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}
    </div>
  );
};

export default ImportExport;

