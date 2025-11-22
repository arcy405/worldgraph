import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const fetchGraphData = async (filters = {}) => {
  try {
    const params = new URLSearchParams();
    
    if (filters.search) {
      params.append('search', filters.search);
    }
    
    if (filters.types && filters.types.length > 0) {
      params.append('types', filters.types.join(','));
    }
    
    if (filters.maxYear) {
      params.append('maxYear', filters.maxYear);
    }
    
    if (filters.minYear) {
      params.append('minYear', filters.minYear);
    }
    
    if (filters.workspace) {
      params.append('workspace', filters.workspace);
    }
    
    if (filters.tags && filters.tags.length > 0) {
      params.append('tags', filters.tags.join(','));
    }
    
    if (filters.page) {
      params.append('page', filters.page);
    }
    
    if (filters.limit) {
      params.append('limit', filters.limit);
    }

    const response = await axios.get(`${API_BASE_URL}/graph?${params.toString()}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching graph data:', error);
    throw error;
  }
};

export const fetchGraphStats = async (workspace = 'default') => {
  try {
    const response = await axios.get(`${API_BASE_URL}/graph/stats?workspace=${workspace}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching graph stats:', error);
    throw error;
  }
};

export const findPath = async (from, to, workspace = 'default', maxDepth = 5) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/graph/path?from=${from}&to=${to}&workspace=${workspace}&maxDepth=${maxDepth}`);
    return response.data;
  } catch (error) {
    console.error('Error finding path:', error);
    throw error;
  }
};

export const importData = async (data, workspace = 'default') => {
  try {
    const response = await axios.post(`${API_BASE_URL}/import/json`, { ...data, workspace });
    return response.data;
  } catch (error) {
    console.error('Error importing data:', error);
    throw error;
  }
};

export const exportData = async (workspace = 'default', format = 'json') => {
  try {
    const response = await axios.get(`${API_BASE_URL}/export/${format}?workspace=${workspace}`, {
      responseType: format === 'csv' ? 'blob' : 'json'
    });
    return response.data;
  } catch (error) {
    console.error('Error exporting data:', error);
    throw error;
  }
};

export const fetchInsights = async (workspace = 'default') => {
  try {
    const response = await axios.get(`${API_BASE_URL}/insights?workspace=${workspace}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching insights:', error);
    throw error;
  }
};

export const fetchInsightType = async (type, workspace = 'default') => {
  try {
    const response = await axios.get(`${API_BASE_URL}/insights/${type}?workspace=${workspace}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching insight type:', error);
    throw error;
  }
};

export const fetchNode = async (id) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/nodes/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching node:', error);
    throw error;
  }
};

export const fetchAllNodes = async (workspace = 'default') => {
  try {
    const response = await axios.get(`${API_BASE_URL}/nodes?workspace=${workspace}&limit=1000`);
    return response.data.nodes || response.data;
  } catch (error) {
    console.error('Error fetching nodes:', error);
    throw error;
  }
};

export const createNode = async (nodeData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/nodes`, nodeData);
    return response.data;
  } catch (error) {
    console.error('Error creating node:', error);
    throw error;
  }
};

export const updateNode = async (id, nodeData) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/nodes/${id}`, nodeData);
    return response.data;
  } catch (error) {
    console.error('Error updating node:', error);
    throw error;
  }
};

export const deleteNode = async (id) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/nodes/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting node:', error);
    throw error;
  }
};

export const createEdge = async (edgeData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/edges`, edgeData);
    return response.data;
  } catch (error) {
    console.error('Error creating edge:', error);
    throw error;
  }
};

export const updateEdge = async (id, edgeData) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/edges/${id}`, edgeData);
    return response.data;
  } catch (error) {
    console.error('Error updating edge:', error);
    throw error;
  }
};

export const deleteEdge = async (id) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/edges/${id}`);
    return response.data;
  } catch (error) {
    console.error('Error deleting edge:', error);
    throw error;
  }
};

