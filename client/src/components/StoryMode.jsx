import React, { useState, useEffect } from 'react';
import { findPath } from '../services/api';
import './StoryMode.css';

const StoryMode = ({ fromNode, toNode, workspace, nodes, onNodeSelect, onClose }) => {
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    if (fromNode && toNode) {
      loadStory();
    }
  }, [fromNode, toNode, workspace]);

  useEffect(() => {
    if (autoPlay && story && currentStep < story.path.length - 1) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => prev + 1);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoPlay, currentStep, story]);

  const loadStory = async () => {
    setLoading(true);
    try {
      const pathData = await findPath(fromNode.id, toNode.id, workspace);
      if (pathData.path && pathData.path.length > 0) {
        const storyNodes = pathData.nodes || [];
        const storyPath = pathData.path.map(id => {
          const node = storyNodes.find(n => n._id === id || n.id === id);
          return node || nodes.find(n => n.id === id);
        }).filter(Boolean);

        setStory({
          from: fromNode,
          to: toNode,
          path: storyPath,
          depth: pathData.depth || storyPath.length - 1
        });
        setCurrentStep(0);
      } else {
        setStory({
          from: fromNode,
          to: toNode,
          path: [fromNode, toNode],
          depth: 1,
          message: 'Direct connection or no path found'
        });
      }
    } catch (error) {
      console.error('Error loading story:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNodeClick = (node) => {
    if (onNodeSelect) {
      onNodeSelect(node);
    }
  };

  const handleNext = () => {
    if (story && currentStep < story.path.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!fromNode || !toNode) {
    return (
      <div className="story-mode">
        <div className="story-placeholder">
          Select two nodes to see their story
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="story-mode">
        <div className="story-loading">Finding the story...</div>
      </div>
    );
  }

  if (!story) {
    return null;
  }

  const currentNode = story.path[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === story.path.length - 1;
  const progress = ((currentStep + 1) / story.path.length) * 100;

  return (
    <div className="story-mode">
      <div className="story-header">
        <h3>📖 Story Mode</h3>
        {onClose && (
          <button className="close-btn" onClick={onClose}>✕</button>
        )}
      </div>

      <div className="story-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="progress-text">
          Step {currentStep + 1} of {story.path.length}
        </div>
      </div>

      <div className="story-content">
        <div className="story-navigation">
          <button 
            onClick={handlePrev} 
            disabled={isFirst}
            className="nav-btn prev"
          >
            ← Previous
          </button>
          <button 
            onClick={() => setAutoPlay(!autoPlay)}
            className="nav-btn play"
          >
            {autoPlay ? '⏸️ Pause' : '▶️ Auto Play'}
          </button>
          <button 
            onClick={handleNext} 
            disabled={isLast}
            className="nav-btn next"
          >
            Next →
          </button>
        </div>

        <div className="story-node">
          <div className="story-node-header">
            <h4 onClick={() => handleNodeClick(currentNode)} className="node-link">
              {currentNode?.label || 'Unknown'}
            </h4>
            <span className="node-type">{currentNode?.group}</span>
          </div>
          
          {currentNode?.info && (
            <p className="story-node-info">{currentNode.info}</p>
          )}

          {currentNode?.year && (
            <div className="story-node-year">Year: {currentNode.year}</div>
          )}

          {!isLast && (
            <div className="story-arrow">↓</div>
          )}
        </div>

        <div className="story-summary">
          <div className="story-path">
            <strong>Path:</strong> {story.from.label} → ... → {story.to.label}
          </div>
          <div className="story-depth">
            <strong>Depth:</strong> {story.depth} step{story.depth !== 1 ? 's' : ''}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoryMode;

