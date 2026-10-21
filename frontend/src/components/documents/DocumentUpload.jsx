import React, { useState, useRef, useEffect, useCallback } from 'react';
import { uploadDocument } from '../../api/documents';
import { formatBytes } from '../../utils/formatters';

const ALLOWED_EXTENSIONS = ['pdf', 'docx', 'txt'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export default function DocumentUpload({ folders = [], activeFolder = 'all', onUploadComplete }) {
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState([]);
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [targetFolder, setTargetFolder] = useState(activeFolder);
  const [customTitle, setCustomTitle] = useState('');
  const fileInputRef = useRef(null);

  // Sync targetFolder with activeFolder prop
  useEffect(() => {
    setTargetFolder(activeFolder);
  }, [activeFolder]);

  // Validate single file client-side
  const validateFile = (file) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return `Unsupported file type (.${ext}). Only .pdf, .docx, and .txt files are allowed.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds the 10 MB limit (${formatBytes(file.size)}).`;
    }
    return null;
  };

  // Add files into upload queue
  const handleFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    const isSingle = filesArray.length === 1;

    const newItems = filesArray.map((file) => {
      const error = validateFile(file);
      return {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        file,
        name: file.name,
        title: isSingle && customTitle.trim() ? customTitle.trim() : '',
        size: file.size,
        status: error ? 'error' : 'idle',
        error: error,
      };
    });

    setQueue((prev) => [...prev, ...newItems]);
    if (isSingle) setCustomTitle('');
  };

  // Sequential queue processor
  const processQueue = useCallback(async () => {
    const nextItem = queue.find((item) => item.status === 'idle');
    if (!nextItem) {
      setIsProcessingQueue(false);
      return;
    }

    setIsProcessingQueue(true);

    // Mark current item uploading
    setQueue((prev) =>
      prev.map((item) => (item.id === nextItem.id ? { ...item, status: 'uploading' } : item))
    );

    const formData = new FormData();
    formData.append('file', nextItem.file);
    if (nextItem.title) {
      formData.append('title', nextItem.title);
    }
    if (targetFolder && targetFolder !== 'all' && targetFolder !== 'unfiled') {
      formData.append('folder', targetFolder);
    }

    try {
      const resultDoc = await uploadDocument(formData);
      const isFailed = resultDoc.status === 'failed';
      setQueue((prev) =>
        prev.map((item) =>
          item.id === nextItem.id
            ? {
                ...item,
                status: isFailed ? 'error' : 'success',
                error: isFailed ? (resultDoc.error_message || 'Document processing failed.') : null,
                document: resultDoc,
              }
            : item
        )
      );
      if (onUploadComplete) onUploadComplete(resultDoc);
    } catch (err) {
      const errMsg =
        err.response?.data?.file?.[0] ||
        err.response?.data?.detail ||
        err.message ||
        'Upload failed.';

      setQueue((prev) =>
        prev.map((item) =>
          item.id === nextItem.id ? { ...item, status: 'error', error: errMsg } : item
        )
      );
      if (onUploadComplete) onUploadComplete(null);
    }
  }, [queue, targetFolder, onUploadComplete]);

  useEffect(() => {
    const hasIdle = queue.some((item) => item.status === 'idle');
    const isCurrentlyUploading = queue.some((item) => item.status === 'uploading');
    if (hasIdle && !isCurrentlyUploading) {
      processQueue();
    }
  }, [queue, processQueue]);

  // Drag and Drop listeners
  const onDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = '';
    }
  };

  const clearCompleted = () => {
    setQueue((prev) => prev.filter((item) => item.status === 'uploading' || item.status === 'idle'));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden mb-6">
      {/* Upload Destination & Options Bar */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label htmlFor="upload-folder-select" className="font-semibold text-slate-600 flex-shrink-0">
            Destination:
          </label>
          <select
            id="upload-folder-select"
            value={String(targetFolder)}
            onChange={(e) => setTargetFolder(e.target.value)}
            className="px-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <option value="all">Unfiled (No folder)</option>
            <option value="unfiled">Unfiled (No folder)</option>
            {folders.map((f) => (
              <option key={f.id} value={String(f.id)}>
                📁 {f.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label htmlFor="upload-custom-title" className="font-semibold text-slate-600 flex-shrink-0">
            Custom title:
          </label>
          <input
            id="upload-custom-title"
            type="text"
            placeholder="Optional (single file)"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            className="w-full sm:w-48 px-2.5 py-1 bg-white border border-slate-300 rounded-md text-xs text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Drop Zone */}
      <div
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`p-6 border-2 border-dashed rounded-xl m-3 text-center transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50/70 scale-[0.995]'
            : 'border-slate-300 hover:border-slate-400 bg-slate-50/50'
        }`}
      >
        <div className="flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 mb-3">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.75" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
              />
            </svg>
          </div>

          <h3 className="text-sm font-semibold text-slate-800">
            Drag and drop your documents here, or{' '}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-blue-600 hover:text-blue-700 underline underline-offset-2 font-medium"
            >
              browse files
            </button>
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Supports <strong className="font-semibold text-slate-600">.pdf</strong>,{' '}
            <strong className="font-semibold text-slate-600">.docx</strong>, and{' '}
            <strong className="font-semibold text-slate-600">.txt</strong> up to 10 MB each.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt"
            onChange={handleFileInputChange}
            className="hidden"
          />
        </div>
      </div>

      {/* Upload Queue View */}
      {queue.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/70 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Upload Queue ({queue.length})
            </span>
            {!isProcessingQueue && (
              <button
                type="button"
                onClick={clearCompleted}
                className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
              >
                Clear finished
              </button>
            )}
          </div>

          <div className="space-y-2">
            {queue.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-lg text-xs shadow-xs"
              >
                <div className="flex items-center gap-2.5 truncate max-w-md">
                  {/* Status Icon */}
                  {item.status === 'idle' && (
                    <span className="w-4 h-4 rounded-full bg-slate-200 flex items-center justify-center text-[9px] text-slate-600 font-bold">
                      •
                    </span>
                  )}
                  {item.status === 'uploading' && (
                    <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  )}
                  {item.status === 'success' && (
                    <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  )}
                  {item.status === 'error' && (
                    <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}

                  <div className="truncate">
                    <span className="font-medium text-slate-800 truncate block" title={item.name}>
                      {item.name}
                    </span>
                    <span className="text-[10px] text-slate-400">{formatBytes(item.size)}</span>
                  </div>
                </div>

                {/* Status Text & Error */}
                <div className="text-right flex items-center gap-2">
                  {item.status === 'uploading' && (
                    <span className="inline-flex items-center text-blue-600 font-medium text-[11px]">
                      Uploading and processing... (this may take a minute)
                    </span>
                  )}
                  {item.status === 'idle' && (
                    <span className="text-slate-400 text-[11px]">Waiting in queue</span>
                  )}
                  {item.status === 'success' && (
                    <span className="text-emerald-600 font-medium text-[11px]">Completed & Ready</span>
                  )}
                  {item.status === 'error' && (
                    <span className="text-rose-600 font-medium text-[11px] max-w-xs text-right">
                      {item.error}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
