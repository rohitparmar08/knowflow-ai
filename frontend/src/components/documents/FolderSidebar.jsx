import React, { useState } from 'react';
import ConfirmDialog from './ConfirmDialog';

export default function FolderSidebar({
  folders = [],
  totalDocCount = 0,
  selectedFolder = 'all',
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [createError, setCreateError] = useState('');
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  const [editingFolderId, setEditingFolderId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editError, setEditError] = useState('');
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const [folderToDelete, setFolderToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Compute unfiled documents count
  const filedCount = folders.reduce((sum, f) => sum + (f.document_count || 0), 0);
  const unfiledCount = Math.max(0, totalDocCount - filedCount);

  // Handle folder creation
  const handleCreateSubmit = async (e) => {
    e?.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed) {
      setCreateError('Folder name cannot be empty.');
      return;
    }
    setCreateError('');
    setIsSubmittingCreate(true);
    try {
      await onCreateFolder(trimmed);
      setNewFolderName('');
      setIsCreating(false);
    } catch (err) {
      const msg =
        err.response?.data?.name?.[0] ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to create folder.';
      setCreateError(msg);
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Start editing a folder
  const handleStartEdit = (folder, e) => {
    e.stopPropagation();
    setEditingFolderId(folder.id);
    setEditingName(folder.name);
    setEditError('');
  };

  // Handle folder rename
  const handleEditSubmit = async (folderId, e) => {
    e?.preventDefault();
    const trimmed = editingName.trim();
    if (!trimmed) {
      setEditError('Folder name cannot be empty.');
      return;
    }
    setEditError('');
    setIsSubmittingEdit(true);
    try {
      await onRenameFolder(folderId, trimmed);
      setEditingFolderId(null);
    } catch (err) {
      const msg =
        err.response?.data?.name?.[0] ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to rename folder.';
      setEditError(msg);
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Handle folder deletion
  const handleConfirmDelete = async () => {
    if (!folderToDelete) return;
    setIsDeleting(true);
    try {
      await onDeleteFolder(folderToDelete.id);
      setFolderToDelete(null);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete folder.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <aside className="w-full md:w-64 flex-shrink-0">
      {/* Mobile Folder Selector Dropdown */}
      <div className="md:hidden mb-4">
        <label htmlFor="mobile-folder-select" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
          Folder Filter
        </label>
        <select
          id="mobile-folder-select"
          value={String(selectedFolder)}
          onChange={(e) => onSelectFolder(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 shadow-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
        >
          <option value="all">📁 All Documents ({totalDocCount})</option>
          <option value="unfiled">📄 Unfiled ({unfiledCount})</option>
          {folders.map((folder) => (
            <option key={folder.id} value={String(folder.id)}>
              📂 {folder.name} ({folder.document_count || 0})
            </option>
          ))}
        </select>
      </div>

      {/* Desktop Folder Sidebar Panel */}
      <div className="hidden md:flex flex-col bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Folders</span>
          <button
            onClick={() => {
              setIsCreating(true);
              setCreateError('');
            }}
            title="Create New Folder"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2 py-1 rounded transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New
          </button>
        </div>

        {/* Inline Create Folder Form */}
        {isCreating && (
          <form onSubmit={handleCreateSubmit} className="p-3 border-b border-slate-100 bg-blue-50/40">
            <input
              type="text"
              autoFocus
              placeholder="Folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-800"
            />
            {createError && <p className="text-[11px] text-red-600 mt-1 font-medium">{createError}</p>}
            <div className="flex justify-end gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => {
                  setIsCreating(false);
                  setNewFolderName('');
                  setCreateError('');
                }}
                className="px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/60 rounded"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingCreate || !newFolderName.trim()}
                className="px-2.5 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
              >
                {isSubmittingCreate ? 'Saving...' : 'Create'}
              </button>
            </div>
          </form>
        )}

        {/* Nav Items List */}
        <div className="p-2 space-y-1">
          {/* All Documents */}
          <button
            onClick={() => onSelectFolder('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
              selectedFolder === 'all'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
                />
              </svg>
              All Documents
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              selectedFolder === 'all' ? 'bg-blue-200/70 text-blue-800' : 'bg-slate-100 text-slate-500'
            }`}>
              {totalDocCount}
            </span>
          </button>

          {/* Unfiled */}
          <button
            onClick={() => onSelectFolder('unfiled')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
              selectedFolder === 'unfiled'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
              Unfiled
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              selectedFolder === 'unfiled' ? 'bg-blue-200/70 text-blue-800' : 'bg-slate-100 text-slate-500'
            }`}>
              {unfiledCount}
            </span>
          </button>

          {/* Separator */}
          {folders.length > 0 && <div className="border-t border-slate-100 my-1" />}

          {/* User Folders List */}
          {folders.map((folder) => {
            const isSelected = String(selectedFolder) === String(folder.id);
            const isEditing = editingFolderId === folder.id;

            if (isEditing) {
              return (
                <div key={folder.id} className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    autoFocus
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleEditSubmit(folder.id, e);
                      if (e.key === 'Escape') setEditingFolderId(null);
                    }}
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  {editError && <p className="text-[11px] text-red-600 mt-1 font-medium">{editError}</p>}
                  <div className="flex justify-end gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setEditingFolderId(null)}
                      className="px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittingEdit || !editingName.trim()}
                      onClick={(e) => handleEditSubmit(folder.id, e)}
                      className="px-2 py-0.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded"
                    >
                      {isSubmittingEdit ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={folder.id}
                onClick={() => onSelectFolder(folder.id)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <svg className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500'}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
                    />
                  </svg>
                  <span className="truncate" title={folder.name}>
                    {folder.name}
                  </span>
                </span>

                <div className="flex items-center gap-1">
                  {/* Actions (visible on group hover) */}
                  <div className="hidden group-hover:flex items-center gap-0.5">
                    <button
                      onClick={(e) => handleStartEdit(folder, e)}
                      title="Rename folder"
                      className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderToDelete(folder);
                      }}
                      title="Delete folder"
                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                        />
                      </svg>
                    </button>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      isSelected ? 'bg-blue-200/70 text-blue-800' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {folder.document_count || 0}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Delete Folder Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(folderToDelete)}
        title="Delete Folder"
        message={`Are you sure you want to delete the folder "${folderToDelete?.name}"?\nDocuments in this folder will not be deleted; they will be moved to Unfiled.`}
        confirmText="Delete Folder"
        confirmVariant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setFolderToDelete(null)}
      />
    </aside>
  );
}
