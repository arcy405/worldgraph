import React, { useState, useEffect } from 'react';
import { fetchInsights } from '../services/api';
import './InsightsPanel.css';

const InsightsPanel = ({ workspace, onNodeSelect, onClose }) => {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    loadInsights();
  }, [workspace]);

  const loadInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchInsights(workspace);
      setInsights(data);
    } catch (err) {
      setError(err.message || 'Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = (nodeId) => {
    if (onNodeSelect) {
      // This will need to be passed from parent or fetched
      onNodeSelect({ id: nodeId });
    }
  };

  if (loading) {
    return (
      <div className="insights-panel">
        <div className="insights-loading">Generating insights...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="insights-panel">
        <div className="insights-error">{error}</div>
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="insights-panel">
        <div className="insights-empty">No insights available</div>
      </div>
    );
  }

  const tabs = [
    { id: 'all', label: 'All Insights', icon: '✨' },
    { id: 'unexpected', label: 'Unexpected', icon: '🔗' },
    { id: 'key', label: 'Key Insights', icon: '⭐' },
    { id: 'gaps', label: 'Gaps', icon: '🔍' },
    { id: 'influence', label: 'Influence', icon: '🌐' },
    { id: 'temporal', label: 'Timeline', icon: '📅' }
  ];

  return (
    <div className="insights-panel">
      <div className="insights-header">
        <h2>
          <span className="insights-icon">💡</span>
          Insights
        </h2>
        <div className="insights-header-actions">
          <button onClick={loadInsights} className="refresh-btn" title="Refresh insights">
            🔄
          </button>
          {onClose && (
            <button onClick={onClose} className="close-btn" title="Close insights">
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="insights-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`insight-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      <div className="insights-content">
        {(activeTab === 'all' || activeTab === 'unexpected') && insights.unexpectedConnections && (
          <InsightSection
            title={insights.unexpectedConnections.title}
            description={insights.unexpectedConnections.description}
            type="unexpected"
          >
            {insights.unexpectedConnections.connections && insights.unexpectedConnections.connections.length > 0 ? (
              insights.unexpectedConnections.connections.map((conn, idx) => (
                <div key={idx} className="insight-item unexpected">
                  <div className="insight-content-text">
                    <div className="insight-title">
                      <span className="node-link" onClick={() => handleNodeClick(conn.nodeA.id)}>
                        {conn.nodeA.label}
                      </span>
                      {' ↔ '}
                      <span className="node-link" onClick={() => handleNodeClick(conn.nodeB.id)}>
                        {conn.nodeB.label}
                      </span>
                    </div>
                    <p className="insight-text">{conn.insight}</p>
                    <div className="insight-meta">
                      {conn.pathCount} path{conn.pathCount !== 1 ? 's' : ''} • {conn.paths.length} shown
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="insight-empty">No unexpected connections found</div>
            )}
          </InsightSection>
        )}

        {(activeTab === 'all' || activeTab === 'key') && insights.keyInsights && (
          <InsightSection
            title={insights.keyInsights.title}
            description={insights.keyInsights.description}
            type="key"
          >
            {insights.keyInsights.insights && insights.keyInsights.insights.length > 0 ? (
              insights.keyInsights.insights.map((insightGroup, idx) => (
                <div key={idx} className="insight-group">
                  <h4>{insightGroup.title}</h4>
                  {insightGroup.nodes && insightGroup.nodes.map((node, nodeIdx) => (
                    <div key={nodeIdx} className="insight-item key">
                      <div className="insight-content-text">
                        <div className="insight-title">
                          <span className="node-link" onClick={() => handleNodeClick(node.id)}>
                            {node.label}
                          </span>
                          {node.degree && <span className="badge">{node.degree} connections</span>}
                        </div>
                        <p className="insight-text">{node.insight}</p>
                      </div>
                    </div>
                  ))}
                  {insightGroup.clusters && insightGroup.clusters.map((cluster, clusterIdx) => (
                    <div key={clusterIdx} className="insight-item cluster">
                      <div className="insight-content-text">
                        <div className="insight-title">Cluster of {cluster.size} nodes</div>
                        <p className="insight-text">{cluster.insight}</p>
                        <div className="cluster-nodes">
                          {cluster.nodes.slice(0, 5).map((node, nodeIdx) => (
                            <span key={nodeIdx} className="cluster-node" onClick={() => handleNodeClick(node.id)}>
                              {node.label}
                            </span>
                          ))}
                          {cluster.nodes.length > 5 && <span className="cluster-more">+{cluster.nodes.length - 5} more</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))
            ) : (
              <div className="insight-empty">No key insights available</div>
            )}
          </InsightSection>
        )}

        {(activeTab === 'all' || activeTab === 'gaps') && insights.knowledgeGaps && (
          <InsightSection
            title={insights.knowledgeGaps.title}
            description={insights.knowledgeGaps.description}
            type="gaps"
          >
            {insights.knowledgeGaps.gaps && insights.knowledgeGaps.gaps.length > 0 ? (
              insights.knowledgeGaps.gaps.map((gap, idx) => (
                <div key={idx} className="insight-item gap">
                  <div className="insight-content-text">
                    <div className="insight-title">
                      <span className="node-link" onClick={() => handleNodeClick(gap.id)}>
                        {gap.label}
                      </span>
                      <span className="badge warning">{gap.degree} connection{gap.degree !== 1 ? 's' : ''}</span>
                    </div>
                    <p className="insight-text">{gap.insight}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="insight-empty">No knowledge gaps found</div>
            )}
          </InsightSection>
        )}

        {(activeTab === 'all' || activeTab === 'influence') && insights.influenceAnalysis && (
          <InsightSection
            title={insights.influenceAnalysis.title}
            description={insights.influenceAnalysis.description}
            type="influence"
          >
            {insights.influenceAnalysis.influencers && insights.influenceAnalysis.influencers.length > 0 ? (
              insights.influenceAnalysis.influencers.map((influencer, idx) => (
                <div key={idx} className="insight-item influence">
                  <div className="insight-content-text">
                    <div className="insight-title">
                      <span className="node-link" onClick={() => handleNodeClick(influencer.id)}>
                        {influencer.label}
                      </span>
                      <span className="badge">{influencer.crossTypeConnections} cross-type</span>
                    </div>
                    <p className="insight-text">{influencer.insight}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="insight-empty">No influential connectors found</div>
            )}
          </InsightSection>
        )}

        {(activeTab === 'all' || activeTab === 'temporal') && insights.temporalPatterns && (
          <InsightSection
            title={insights.temporalPatterns.title}
            description={insights.temporalPatterns.description}
            type="temporal"
          >
            {insights.temporalPatterns.patterns && (
              <>
                {insights.temporalPatterns.patterns.peakYears && insights.temporalPatterns.patterns.peakYears.length > 0 && (
                  <div className="temporal-section">
                    <h4>Peak Years</h4>
                    {insights.temporalPatterns.patterns.peakYears.map((year, idx) => (
                      <div key={idx} className="insight-item temporal">
                        <div className="insight-content-text">
                          <div className="insight-title">
                            <span className="year-badge">{year.year}</span>
                            <span className="badge">{year.count} entities</span>
                          </div>
                          <p className="insight-text">{year.insight}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {insights.temporalPatterns.patterns.longTermConnections && insights.temporalPatterns.patterns.longTermConnections.length > 0 && (
                  <div className="temporal-section">
                    <h4>Long-term Connections</h4>
                    {insights.temporalPatterns.patterns.longTermConnections.map((conn, idx) => (
                      <div key={idx} className="insight-item temporal">
                        <div className="insight-content-text">
                          <div className="insight-title">
                            <span className="node-link" onClick={() => handleNodeClick(conn.from.id)}>
                              {conn.from.label}
                            </span>
                            {' → '}
                            <span className="node-link" onClick={() => handleNodeClick(conn.to.id)}>
                              {conn.to.label}
                            </span>
                            <span className="badge">{conn.timeSpan} years</span>
                          </div>
                          <p className="insight-text">{conn.insight}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </InsightSection>
        )}
      </div>
    </div>
  );
};

const InsightSection = ({ title, description, type, children }) => {
  return (
    <div className={`insight-section insight-section-${type}`}>
      <div className="insight-section-header">
        <h3>{title}</h3>
        <p className="insight-section-desc">{description}</p>
      </div>
      <div className="insight-items">
        {children}
      </div>
    </div>
  );
};

export default InsightsPanel;

