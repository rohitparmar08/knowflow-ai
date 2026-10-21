import api from './client';

/**
 * Fetch all folders for current user (returns plain array of folders).
 */
export async function getFolders() {
  const response = await api.get('/folders/');
  return response.data;
}

/**
 * Create a new folder.
 */
export async function createFolder(name) {
  const response = await api.post('/folders/', { name });
  return response.data;
}

/**
 * Rename an existing folder.
 */
export async function updateFolder(id, name) {
  const response = await api.patch(`/folders/${id}/`, { name });
  return response.data;
}

/**
 * Delete a folder.
 */
export async function deleteFolder(id) {
  const response = await api.delete(`/folders/${id}/`);
  return response.data;
}

/**
 * Fetch paginated documents with optional filters:
 * - folder: 'all' | 'unfiled' | folderId
 * - search: string
 * - status: 'all' | 'uploaded' | 'processing' | 'ready' | 'failed'
 * - page: number
 */
export async function getDocuments({ page = 1, folder = 'all', search = '', status = 'all' } = {}) {
  const params = {};
  if (page) {
    params.page = page;
  }
  if (folder === 'unfiled') {
    params.folder = 'null';
  } else if (folder && folder !== 'all') {
    params.folder = folder;
  }
  if (search && search.trim()) {
    params.search = search.trim();
  }
  if (status && status !== 'all') {
    params.status = status;
  }

  const response = await api.get('/documents/', { params });
  return response.data;
}

/**
 * Upload a document synchronously. Ingestion/embedding occurs on backend.
 * Generous timeout (120s) ensures large files are processed without client timeouts.
 */
export async function uploadDocument(formData, config = {}) {
  const response = await api.post('/documents/', formData, {
    timeout: 120000,
    ...config,
  });
  return response.data;
}

/**
 * Update document title and/or folder.
 * folder can be integer ID or null (unfiled).
 */
export async function updateDocument(id, data) {
  const response = await api.patch(`/documents/${id}/`, data);
  return response.data;
}

/**
 * Delete a document.
 */
export async function deleteDocument(id) {
  const response = await api.delete(`/documents/${id}/`);
  return response.data;
}

/**
 * Reprocess an existing document (runs extraction, chunking, and embedding).
 */
export async function reprocessDocument(id) {
  const response = await api.post(`/documents/${id}/reprocess/`, null, {
    timeout: 120000,
  });
  return response.data;
}

/**
 * Fetch chunk details for a document.
 */
export async function getDocumentChunks(id) {
  const response = await api.get(`/documents/${id}/chunks/`);
  return response.data;
}
