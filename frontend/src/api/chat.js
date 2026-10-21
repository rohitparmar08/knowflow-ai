import api from './client';
import { getDocuments } from './documents';

/**
 * Fetch all conversations for the authenticated user.
 * Returns a plain array ordered by -updated_at.
 */
export async function getConversations() {
  const response = await api.get('/chat/conversations/');
  return response.data;
}

/**
 * Fetch a conversation's details and full message history.
 */
export async function getConversationDetail(id) {
  const response = await api.get(`/chat/conversations/${id}/`);
  return response.data;
}

/**
 * Update (rename) a conversation's title.
 */
export async function updateConversationTitle(id, title) {
  const response = await api.patch(`/chat/conversations/${id}/`, { title });
  return response.data;
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(id) {
  const response = await api.delete(`/chat/conversations/${id}/`);
  return response.data;
}

/**
 * Submit a question to the RAG pipeline.
 * Configured with a 90s timeout specifically for LLM generation.
 */
export async function askQuestion({ question, conversation_id, folder_id, document_ids }) {
  const payload = { question };

  if (conversation_id !== undefined && conversation_id !== null) {
    payload.conversation_id = conversation_id;
  }
  if (folder_id !== undefined && folder_id !== null) {
    payload.folder_id = folder_id;
  } else if (document_ids && document_ids.length > 0) {
    payload.document_ids = document_ids;
  }

  const response = await api.post('/chat/ask/', payload, {
    timeout: 90000,
  });
  return response.data;
}

/**
 * Fetch all documents with status="ready" by paging through the API until all are loaded.
 */
export async function getAllReadyDocuments() {
  let allDocs = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const data = await getDocuments({ page, status: 'ready', folder: 'all' });
    const results = data.results || [];
    allDocs = [...allDocs, ...results];
    if (data.next) {
      page += 1;
    } else {
      hasMore = false;
    }
  }

  return allDocs;
}
