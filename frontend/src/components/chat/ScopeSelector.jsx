import React, { useState, useMemo } from 'react';

export default function ScopeSelector({
  folders = [],
  readyDocuments = [],
  scopeType = 'all', // 'all' | 'folder' | 'documents'
  selectedFolderId = null,
  selectedDocumentIds = [],
  onScopeChange,
}) {
  const [docSearch, setDocSearch] = useState('');

  // Filter ready documents for searchable multi-select
  const filteredDocs = useMemo(() => {
    if (!docSearch.trim()) return readyDocuments;
    const q = docSearch.toLowerCase();
    return readyDocuments.filter((d) => d.title.toLowerCase().includes(q));
  }, [readyDocuments, docSearch]);

  const activeFolderName = useMemo(() => {
    if (!selectedFolderId) return '';
    const f = folders.find((item) => String(item.id) === String(selectedFolderId));
    return f ? f.name : 'Unknown folder';
  }, [folders, selectedFolderId]);

  const handleSelectScopeType = (type) => {
    if (type === 'all') {
      onScopeChange({ scopeType: 'all', folderId: null, documentIds: [] });
    } else if (type === 'folder') {
      const defaultFolderId = folders.length > 0 ? folders[0].id : null;
      onScopeChange({ scopeType: 'folder', folderId: defaultFolderId, documentIds: [] });
    } else if (type === 'documents') {
      onScopeChange({ scopeType: 'documents', folderId: null, documentIds: selectedDocumentIds });
    }
  };

  const handleToggleDoc = (docId) => {
    let next;
    if (selectedDocumentIds.includes(docId)) {
      next = selectedDocumentIds.filter((id) => id !== docId);
    } else {
      next = [...selectedDocumentIds, docId];
    }
    onScopeChange({ scopeType: 'documents', folderId: null, documentIds: next });
  };

  return (
    <div className="mb-3 space-y-2">
      {/* Scope Mode Selector Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium text-slate-600">
          <button
            type="button"
            onClick={() => handleSelectScopeType('all')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              scopeType === 'all'
                ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            All documents
          </button>
          <button
            type="button"
            onClick={() => handleSelectScopeType('folder')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              scopeType === 'folder'
                ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            A folder
          </button>
          <button
            type="button"
            onClick={() => handleSelectScopeType('documents')}
            className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
              scopeType === 'documents'
                ? 'bg-white text-blue-700 shadow-2xs font-semibold'
                : 'hover:text-slate-900'
            }`}
          >
            Specific documents
          </button>
        </div>

        {/* Active Scope Chip */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          {scopeType === 'all' && <span>🌐 Scope: All documents</span>}
          {scopeType === 'folder' && (
            <>
              <span className="truncate max-w-[150px]">📁 Folder: {activeFolderName || 'None'}</span>
              <button
                type="button"
                onClick={() => handleSelectScopeType('all')}
                className="text-slate-400 hover:text-slate-600 ml-1"
                title="Reset to All documents"
              >
                ×
              </button>
            </>
          )}
          {scopeType === 'documents' && (
            <>
              <span>📄 Scope: {selectedDocumentIds.length} doc(s)</span>
              <button
                type="button"
                onClick={() => handleSelectScopeType('all')}
                className="text-slate-400 hover:text-slate-600 ml-1"
                title="Reset to All documents"
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sub-selector: When Folder mode is chosen */}
      {scopeType === 'folder' && (
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3 text-xs">
          <label htmlFor="folder-scope-select" className="font-semibold text-slate-600 whitespace-nowrap">
            Select Folder:
          </label>
          <select
            id="folder-scope-select"
            value={selectedFolderId || ''}
            onChange={(e) =>
              onScopeChange({
                scopeType: 'folder',
                folderId: e.target.value ? Number(e.target.value) : null,
                documentIds: [],
              })
            }
            className="flex-1 max-w-sm px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            {folders.length === 0 ? (
              <option value="">No folders available</option>
            ) : (
              folders.map((f) => (
                <option key={f.id} value={f.id}>
                  📁 {f.name} ({f.document_count || 0} docs)
                </option>
              ))
            )}
          </select>
        </div>
      )}

      {/* Sub-selector: When Specific Documents mode is chosen */}
      {scopeType === 'documents' && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              placeholder="Search ready documents..."
              value={docSearch}
              onChange={(e) => setDocSearch(e.target.value)}
              className="flex-1 px-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
            <div className="flex items-center gap-2 text-[11px] text-blue-600 font-semibold">
              <button
                type="button"
                onClick={() =>
                  onScopeChange({
                    scopeType: 'documents',
                    folderId: null,
                    documentIds: readyDocuments.map((d) => d.id),
                  })
                }
                className="hover:underline"
              >
                Select all
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={() =>
                  onScopeChange({
                    scopeType: 'documents',
                    folderId: null,
                    documentIds: [],
                  })
                }
                className="hover:underline"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1 divide-y divide-slate-100 bg-white border border-slate-200 rounded-md p-1.5">
            {filteredDocs.length === 0 ? (
              <p className="text-center py-3 text-slate-400">No ready documents found.</p>
            ) : (
              filteredDocs.map((doc) => {
                const isSelected = selectedDocumentIds.includes(doc.id);
                return (
                  <label
                    key={doc.id}
                    className="flex items-center gap-2 p-1.5 hover:bg-slate-50 rounded cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleDoc(doc.id)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="truncate flex-1 font-medium text-slate-700" title={doc.title}>
                      {doc.title}
                    </span>
                    <span className="text-[10px] text-slate-400 uppercase font-mono">
                      {doc.file_type}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
