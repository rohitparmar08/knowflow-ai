import React, { useState, useEffect } from 'react';
import { formatBytes, formatDate } from '../../utils/formatters';

const STATUS_CONFIG = {
  uploaded: {
    label: 'Uploaded',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
    dotClass: 'bg-slate-400',
  },
  processing: {
    label: 'Processing',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse',
    dotClass: 'bg-amber-500',
  },
  ready: {
    label: 'Ready',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
  failed: {
    label: 'Failed',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    dotClass: 'bg-rose-500',
  },
};

export default function DocumentList({
  documents = [],
  count = 0,
  page = 1,
  pageSize = 10,
  hasPrevious = false,
  hasNext = false,
  loading = false,
  search = '',
  status = 'all',
  selectedFolder = 'all',
  onSearchChange,
  onStatusChange,
  onPageChange,
  onClearFilters,
  onViewChunks,
  onEditDoc,
  onDeleteDoc,
  onReprocessDoc,
}) {
  const [localSearch, setLocalSearch] = useState(search);
  const [reprocessingId, setReprocessingId] = useState(null);
  const [expandedErrorDocId, setExpandedErrorDocId] = useState(null);

  // Sync prop changes into local search
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Debounce search by 400ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        onSearchChange(localSearch);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearch, search, onSearchChange]);

  const handleReprocess = async (docId) => {
    setReprocessingId(docId);
    try {
      await onReprocessDoc(docId);
    } finally {
      setReprocessingId(null);
    }
  };

  const totalPages = Math.ceil(count / pageSize) || 1;
  const startItem = count === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, count);
  const isFiltered = Boolean(search.trim() || status !== 'all' || selectedFolder !== 'all');

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden flex flex-col">
      {/* Top Filter & Search Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50/50">
        {/* Search Box */}
        <div className="relative flex-1 max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search documents by title..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 shadow-2xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
          {localSearch && (
            <button
              onClick={() => {
                setLocalSearch('');
                onSearchChange('');
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Status Dropdown Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="status-filter" className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Status:
          </label>
          <select
            id="status-filter"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-700 shadow-2xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="all">All statuses</option>
            <option value="ready">Ready</option>
            <option value="processing">Processing</option>
            <option value="uploaded">Uploaded</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-600 border-collapse">
          <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Title</th>
              <th className="py-3 px-3">Type</th>
              <th className="py-3 px-3">Size</th>
              <th className="py-3 px-3">Folder</th>
              <th className="py-3 px-3">Status</th>
              <th className="py-3 px-3">Added</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {/* Loading Skeleton */}
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="animate-pulse">
                  <td className="py-4 px-4">
                    <div className="h-4 bg-slate-200 rounded w-48 mb-1" />
                    <div className="h-3 bg-slate-100 rounded w-24" />
                  </td>
                  <td className="py-4 px-3"><div className="h-4 bg-slate-200 rounded w-8" /></td>
                  <td className="py-4 px-3"><div className="h-4 bg-slate-200 rounded w-12" /></td>
                  <td className="py-4 px-3"><div className="h-4 bg-slate-200 rounded w-16" /></td>
                  <td className="py-4 px-3"><div className="h-5 bg-slate-200 rounded-full w-16" /></td>
                  <td className="py-4 px-3"><div className="h-4 bg-slate-200 rounded w-20" /></td>
                  <td className="py-4 px-4 text-right"><div className="h-6 bg-slate-200 rounded w-20 ml-auto" /></td>
                </tr>
              ))}

            {/* Empty State */}
            {!loading && documents.length === 0 && (
              <tr>
                <td colSpan={7} className="py-16 text-center text-slate-400">
                  <div className="max-w-sm mx-auto flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                      <svg className="w-6 h-6 stroke-current" fill="none" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                        />
                      </svg>
                    </div>
                    {isFiltered ? (
                      <>
                        <h4 className="text-sm font-semibold text-slate-700">No matching documents</h4>
                        <p className="text-xs text-slate-500 mt-1 mb-4">
                          No documents matched your active search query or filter criteria.
                        </p>
                        <button
                          onClick={onClearFilters}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                        >
                          Reset Filters
                        </button>
                      </>
                    ) : (
                      <>
                        <h4 className="text-sm font-semibold text-slate-700">No documents yet</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Upload your first PDF, DOCX, or TXT file using the upload area above.
                        </p>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}

            {/* Document Rows */}
            {!loading &&
              documents.map((doc) => {
                const statusInfo = STATUS_CONFIG[doc.status] || STATUS_CONFIG.uploaded;
                const isFailed = doc.status === 'failed';
                const isReprocessing = reprocessingId === doc.id;
                const isErrorExpanded = expandedErrorDocId === doc.id;

                return (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Title */}
                    <td className="py-3.5 px-4 font-medium text-slate-800 max-w-xs">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200 flex-shrink-0">
                          {doc.file_type || 'TXT'}
                        </span>
                        <div className="truncate">
                          <span className="truncate block font-semibold text-slate-800" title={doc.title}>
                            {doc.title}
                          </span>
                          {/* If chunks available */}
                          {doc.chunk_count > 0 && (
                            <span className="text-[11px] text-slate-400">
                              {doc.chunk_count} {doc.chunk_count === 1 ? 'chunk' : 'chunks'}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Type */}
                    <td className="py-3.5 px-3 uppercase text-slate-500 font-mono text-[11px]">
                      {doc.file_type}
                    </td>

                    {/* Size */}
                    <td className="py-3.5 px-3 text-slate-500 font-mono text-[11px]">
                      {formatBytes(doc.file_size)}
                    </td>

                    {/* Folder */}
                    <td className="py-3.5 px-3 text-slate-600">
                      {doc.folder_name ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[11px] font-medium border border-blue-100 max-w-[120px] truncate" title={doc.folder_name}>
                          📁 {doc.folder_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Unfiled</span>
                      )}
                    </td>

                    {/* Status & Error */}
                    <td className="py-3.5 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusInfo.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dotClass}`} />
                          {statusInfo.label}
                        </span>

                        {/* Error message display if failed */}
                        {isFailed && doc.error_message && (
                          <div className="mt-1 max-w-xs">
                            <p
                              onClick={() => setExpandedErrorDocId(isErrorExpanded ? null : doc.id)}
                              className={`text-[11px] text-red-600 bg-red-50 p-1.5 rounded border border-red-200 cursor-pointer ${
                                isErrorExpanded ? '' : 'truncate max-w-[180px]'
                              }`}
                              title={doc.error_message}
                            >
                              {doc.error_message}
                            </p>
                            <button
                              onClick={() => handleReprocess(doc.id)}
                              disabled={isReprocessing}
                              className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-red-700 hover:text-red-900 underline disabled:opacity-50"
                            >
                              {isReprocessing ? (
                                <>
                                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path
                                      className="opacity-75"
                                      fill="currentColor"
                                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                  </svg>
                                  Reprocessing...
                                </>
                              ) : (
                                'Reprocess'
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Added Date */}
                    <td className="py-3.5 px-3 text-slate-500 whitespace-nowrap text-[11px]">
                      {formatDate(doc.created_at)}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* Open Original File */}
                        {doc.file && (
                          <a
                            href={doc.file}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open original file"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
                              />
                            </svg>
                          </a>
                        )}

                        {/* View Chunks */}
                        <button
                          onClick={() => onViewChunks(doc)}
                          title="View chunks"
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                            />
                          </svg>
                        </button>

                        {/* Edit Document */}
                        <button
                          onClick={() => onEditDoc(doc)}
                          title="Edit title & folder"
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                            />
                          </svg>
                        </button>

                        {/* Delete Document */}
                        <button
                          onClick={() => onDeleteDoc(doc)}
                          title="Delete document"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                            />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {count > 0 && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div>
            Showing <span className="font-semibold text-slate-700">{startItem}</span> to{' '}
            <span className="font-semibold text-slate-700">{endItem}</span> of{' '}
            <span className="font-semibold text-slate-700">{count}</span> documents
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || !hasPrevious}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors"
            >
              Previous
            </button>
            <span className="px-2 font-medium text-slate-600">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || !hasNext}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
