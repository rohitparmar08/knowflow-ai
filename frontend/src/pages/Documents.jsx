import React, { useState, useEffect, useCallback } from 'react';
import {
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  getDocuments,
  updateDocument,
  deleteDocument,
  reprocessDocument,
} from '../api/documents';
import FolderSidebar from '../components/documents/FolderSidebar';
import DocumentUpload from '../components/documents/DocumentUpload';
import DocumentList from '../components/documents/DocumentList';
import ChunksModal from '../components/documents/ChunksModal';
import EditDocumentModal from '../components/documents/EditDocumentModal';
import ConfirmDialog from '../components/documents/ConfirmDialog';

export default function Documents() {
  const [folders, setFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('all');
  const [documents, setDocuments] = useState([]);
  const [count, setCount] = useState(0);
  const [totalDocCount, setTotalDocCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);

  const [, setLoadingFolders] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [bannerError, setBannerError] = useState('');

  // Modals state
  const [chunksDoc, setChunksDoc] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // Fetch folders list
  const fetchFolderList = useCallback(async () => {
    try {
      const data = await getFolders();
      setFolders(data);
    } catch (err) {
      console.error('Failed to fetch folders:', err);
      setBannerError(
        err.response?.data?.detail || err.message || 'Failed to load folders. Please try again.'
      );
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  // Fetch total count of all documents across the system for the user
  const fetchTotalCount = useCallback(async () => {
    try {
      const res = await getDocuments({ folder: 'all', page: 1 });
      setTotalDocCount(res.count || 0);
    } catch {
      // Non-critical, ignore
    }
  }, []);

  // Fetch paginated documents
  const fetchDocumentList = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const data = await getDocuments({
        page,
        folder: selectedFolder,
        search,
        status,
      });
      setDocuments(data.results || []);
      setCount(data.count || 0);
      setHasNext(Boolean(data.next));
      setHasPrevious(Boolean(data.previous));
      setBannerError('');
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setBannerError(
        err.response?.data?.detail || err.message || 'Failed to load documents. Please check your network or server.'
      );
    } finally {
      setLoadingDocs(false);
    }
  }, [page, selectedFolder, search, status]);

  // Initial load
  useEffect(() => {
    fetchFolderList();
    fetchTotalCount();
  }, [fetchFolderList, fetchTotalCount]);

  // Fetch documents on parameter change
  useEffect(() => {
    fetchDocumentList();
  }, [fetchDocumentList]);

  // Handle Folder Actions
  const handleSelectFolder = (folderId) => {
    setSelectedFolder(folderId);
    setPage(1);
  };

  const handleCreateFolder = async (name) => {
    await createFolder(name);
    await fetchFolderList();
  };

  const handleRenameFolder = async (id, name) => {
    await updateFolder(id, name);
    await fetchFolderList();
    await fetchDocumentList();
  };

  const handleDeleteFolder = async (id) => {
    await deleteFolder(id);
    if (String(selectedFolder) === String(id)) {
      setSelectedFolder('all');
    }
    await fetchFolderList();
    await fetchDocumentList();
  };

  // Handle Search and Filter changes
  const handleSearchChange = (newSearch) => {
    setSearch(newSearch);
    setPage(1);
  };

  const handleStatusChange = (newStatus) => {
    setStatus(newStatus);
    setPage(1);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatus('all');
    setSelectedFolder('all');
    setPage(1);
  };

  // Handle Upload Complete
  const handleUploadComplete = async () => {
    await fetchFolderList();
    await fetchTotalCount();
    await fetchDocumentList();
  };

  // Handle Document Edit
  const handleSaveEditDoc = async (docId, data) => {
    await updateDocument(docId, data);
    await fetchFolderList();
    await fetchDocumentList();
  };

  // Handle Document Delete
  const handleConfirmDeleteDoc = async () => {
    if (!deletingDoc) return;
    setIsDeletingDoc(true);
    try {
      await deleteDocument(deletingDoc.id);
      setDeletingDoc(null);
      await fetchFolderList();
      await fetchTotalCount();
      await fetchDocumentList();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete document.');
    } finally {
      setIsDeletingDoc(false);
    }
  };

  // Handle Reprocess
  const handleReprocessDoc = async (docId) => {
    await reprocessDocument(docId);
    await fetchDocumentList();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Knowledge Documents</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Upload, categorize into folders, extract text, and index your documents for RAG chat.
          </p>
        </div>
      </div>

      {/* Dismissible Error Banner */}
      {bannerError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start justify-between shadow-xs">
          <div className="flex items-start gap-2.5">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <span className="font-semibold">Notice:</span> {bannerError}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                fetchFolderList();
                fetchDocumentList();
              }}
              className="text-xs font-semibold text-red-700 underline hover:text-red-900 cursor-pointer"
            >
              Retry
            </button>
            <button
              onClick={() => setBannerError('')}
              className="text-red-400 hover:text-red-600 p-1 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Upload Zone */}
      <DocumentUpload
        folders={folders}
        activeFolder={selectedFolder}
        onUploadComplete={handleUploadComplete}
      />

      {/* Main Two-Column Layout (Responsive) */}
      <div className="flex flex-col md:flex-row items-start gap-6">
        {/* Left Column: Folders */}
        <FolderSidebar
          folders={folders}
          totalDocCount={totalDocCount}
          selectedFolder={selectedFolder}
          onSelectFolder={handleSelectFolder}
          onCreateFolder={handleCreateFolder}
          onRenameFolder={handleRenameFolder}
          onDeleteFolder={handleDeleteFolder}
        />

        {/* Right Area: Documents List */}
        <div className="flex-1 w-full min-w-0">
          <DocumentList
            documents={documents}
            count={count}
            page={page}
            pageSize={10}
            hasNext={hasNext}
            hasPrevious={hasPrevious}
            loading={loadingDocs}
            search={search}
            status={status}
            selectedFolder={selectedFolder}
            onSearchChange={handleSearchChange}
            onStatusChange={handleStatusChange}
            onPageChange={(newPage) => setPage(newPage)}
            onClearFilters={handleClearFilters}
            onViewChunks={(doc) => setChunksDoc(doc)}
            onEditDoc={(doc) => setEditingDoc(doc)}
            onDeleteDoc={(doc) => setDeletingDoc(doc)}
            onReprocessDoc={handleReprocessDoc}
          />
        </div>
      </div>

      {/* Chunks Viewer Modal */}
      <ChunksModal
        isOpen={Boolean(chunksDoc)}
        document={chunksDoc}
        onClose={() => setChunksDoc(null)}
      />

      {/* Edit Document Modal */}
      <EditDocumentModal
        isOpen={Boolean(editingDoc)}
        document={editingDoc}
        folders={folders}
        onClose={() => setEditingDoc(null)}
        onSave={handleSaveEditDoc}
      />

      {/* Delete Document Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingDoc)}
        title="Delete Document"
        message={`Are you sure you want to delete "${deletingDoc?.title}"?\nThis will remove the file and all generated embedding chunks permanently.`}
        confirmText="Delete Document"
        confirmVariant="danger"
        loading={isDeletingDoc}
        onConfirm={handleConfirmDeleteDoc}
        onClose={() => setDeletingDoc(null)}
      />
    </div>
  );
}
