import React, { useState, useEffect } from 'react';
import { ingestFromWeb, previewTopic, fetchSources } from '../services/api';
import './WebIngest.css';

const DEPTH_LABELS = {
  1: 'Seeds + their direct relations',
  2: 'Also expand the best-connected neighbours',
  3: 'Three levels out (slow, much denser)'
};

const WebIngest = ({ workspace, onIngestComplete }) => {
  const [sources, setSources] = useState([]);
  const [sourceId, setSourceId] = useState('wikidata');
  const [topic, setTopic] = useState('');
  const [depth, setDepth] = useState(2);
  const [maxNodes, setMaxNodes] = useState(250);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchSources().then(list => {
      if (!cancelled && list.length) setSources(list);
    });
    return () => { cancelled = true; };
  }, []);

  const activeSource = sources.find(s => s.id === sourceId);

  const startTimer = () => {
    setElapsed(0);
    const started = Date.now();
    return setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
  };

  const handlePreview = async () => {
    if (!topic.trim()) {
      setError('Enter a topic first');
      return;
    }
    setBusy(true);
    setPhase('Searching Wikipedia...');
    setError(null);
    setResult(null);
    setPreview(null);
    try {
      const data = await previewTopic(topic.trim());
      setPreview(data);
      if (data.count === 0) {
        setError(`No Wikipedia articles matched "${topic}"`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
      setPhase('');
    }
  };

  const handleIngest = async () => {
    if (!topic.trim()) {
      setError('Enter a topic first');
      return;
    }
    setBusy(true);
    setPhase('Fetching from Wikipedia and Wikidata...');
    setError(null);
    setResult(null);
    const timer = startTimer();
    try {
      const data = await ingestFromWeb({
        source: sourceId,
        topic: topic.trim(),
        seeds: 25,
        maxNodes: Number(maxNodes),
        depth: Number(depth),
        workspace
      });
      setResult(data);
      setPreview(null);
      if (onIngestComplete) onIngestComplete();
    } catch (err) {
      setError(err.message);
    } finally {
      clearInterval(timer);
      setBusy(false);
      setPhase('');
    }
  };

  return (
    <div className="web-ingest">
      <h3>🌍 Pull from the web</h3>
      <p className="web-ingest-hint">
        Real entities and typed relations, loaded into the{' '}
        <strong>{workspace}</strong> workspace.
      </p>

      <select
        className="web-ingest-source"
        value={sourceId}
        disabled={busy}
        onChange={(e) => { setSourceId(e.target.value); setPreview(null); setResult(null); setError(null); }}
      >
        {(sources.length ? sources : [{ id: 'wikidata', label: 'Wikipedia + Wikidata' }]).map((s) => (
          <option key={s.id} value={s.id}>{s.label}</option>
        ))}
      </select>
      {activeSource && (
        <p className="web-ingest-source-note">{activeSource.description}</p>
      )}

      <input
        type="text"
        className="web-ingest-topic"
        placeholder={activeSource?.placeholder || 'Enter a topic'}
        value={topic}
        disabled={busy}
        onChange={(e) => setTopic(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && !busy && handleIngest()}
      />

      <div className="web-ingest-controls">
        <label>
          Depth
          <select value={depth} disabled={busy} onChange={(e) => setDepth(e.target.value)}>
            <option value={1}>1 — direct</option>
            <option value={2}>2 — expanded</option>
            <option value={3}>3 — deep</option>
          </select>
        </label>
        <label>
          Max nodes
          <select value={maxNodes} disabled={busy} onChange={(e) => setMaxNodes(e.target.value)}>
            <option value={100}>100</option>
            <option value={250}>250</option>
            <option value={500}>500</option>
          </select>
        </label>
      </div>
      <p className="web-ingest-depth-note">{DEPTH_LABELS[depth]}</p>

      <div className="web-ingest-actions">
        {sourceId === 'wikidata' && (
          <button className="web-ingest-btn secondary" onClick={handlePreview} disabled={busy}>
            Preview
          </button>
        )}
        <button className="web-ingest-btn primary" onClick={handleIngest} disabled={busy}>
          {busy ? 'Working…' : 'Pull into graph'}
        </button>
      </div>

      {busy && (
        <div className="web-ingest-status">
          <span className="web-ingest-spinner" />
          {phase} {elapsed > 0 && <span className="web-ingest-elapsed">{elapsed}s</span>}
        </div>
      )}

      {error && <div className="web-ingest-error">{error}</div>}

      {preview && preview.count > 0 && (
        <div className="web-ingest-preview">
          <h4>{preview.count} articles would seed the graph</h4>
          <ul>
            {preview.pages.map((p) => (
              <li key={p.qid}>
                <span className="web-ingest-title">{p.title}</span>
                <span className="web-ingest-qid">{p.qid}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (
        <div className="web-ingest-result">
          <h4>{result.source?.label || 'Source'} → “{result.workspace}”</h4>
          <div className="web-ingest-stats">
            <div><strong>{result.stats.nodesCreated}</strong><span>new nodes</span></div>
            <div><strong>{result.stats.edgesCreated}</strong><span>new edges</span></div>
            <div><strong>{result.stats.nodesUpdated}</strong><span>refreshed</span></div>
            <div><strong>{result.stats.types}</strong><span>entity types</span></div>
            {result.stats.citationEdges > 0 && (
              <div><strong>{result.stats.citationEdges}</strong><span>citations</span></div>
            )}
            {result.stats.relationTypes > 0 && (
              <div><strong>{result.stats.relationTypes}</strong><span>relation types</span></div>
            )}
          </div>
          <details>
            <summary>What it did</summary>
            <ul>
              {result.log.map((line, i) => <li key={i}>{line}</li>)}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
};

export default WebIngest;
