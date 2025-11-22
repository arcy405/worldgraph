import React, { useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './GraphExporter.css';

const GraphExporter = ({ graphContainerRef, graphName = 'worldgraph' }) => {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);

  const exportAsImage = async (format = 'png') => {
    if (!graphContainerRef?.current) {
      setError('Graph container not found');
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const canvas = await html2canvas(graphContainerRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
        useCORS: true,
        logging: false
      });

      if (format === 'png') {
        const link = document.createElement('a');
        link.download = `${graphName}-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } else if (format === 'jpg') {
        const link = document.createElement('a');
        link.download = `${graphName}-${Date.now()}.jpg`;
        link.href = canvas.toDataURL('image/jpeg', 0.9);
        link.click();
      }
    } catch (err) {
      setError(err.message || 'Failed to export image');
    } finally {
      setExporting(false);
    }
  };

  const exportAsPDF = async () => {
    if (!graphContainerRef?.current) {
      setError('Graph container not found');
      return;
    }

    setExporting(true);
    setError(null);

    try {
      const canvas = await html2canvas(graphContainerRef.current, {
        backgroundColor: '#0f172a',
        scale: 2,
        useCORS: true,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = (pdfHeight - imgHeight * ratio) / 2;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      pdf.save(`${graphName}-${Date.now()}.pdf`);
    } catch (err) {
      setError(err.message || 'Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="graph-exporter">
      <h4>Export Graph</h4>
      <div className="export-buttons">
        <button 
          onClick={() => exportAsImage('png')} 
          disabled={exporting}
          className="export-btn"
        >
          {exporting ? 'Exporting...' : '📷 PNG'}
        </button>
        <button 
          onClick={() => exportAsImage('jpg')} 
          disabled={exporting}
          className="export-btn"
        >
          {exporting ? 'Exporting...' : '🖼️ JPG'}
        </button>
        <button 
          onClick={exportAsPDF} 
          disabled={exporting}
          className="export-btn"
        >
          {exporting ? 'Exporting...' : '📄 PDF'}
        </button>
      </div>
      {error && <div className="export-error">{error}</div>}
    </div>
  );
};

export default GraphExporter;

