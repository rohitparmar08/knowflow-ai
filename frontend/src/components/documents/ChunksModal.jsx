import React, { useState, useEffect } from 'react';
import { getDocumentChunks } from '../../api/documents';

export default function ChunksModal({ isOpen, document: doc, onClose }) {
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);

  useEffect(() => {
    if (!isOpen || !doc) {
      setChunks([]);
      setError('');
      return;
    }

    let isMounted = true;
    async function fetchChunks() {
      setLoading(true);
      setError('');
      try {
        const data = await getDocumentChunks(doc.id);
        if (isMounted) setChunks(data);
      } catch (err) {
        if (isMounted) {
          setError(
            err.response?.data?.detail ||
            err.message ||
            'Failed to load document chunks.'
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchChunks();
    return () => {
      isMounted = false;
    };
  }, [isOpen, doc]);

  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => {
      setCopiedIndex(null);
    }, 2000);
  };

  if (!isOpen || !doc) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div className="relative w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all border border-slate-200 flex flex-col max-h-[85vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold uppercase">
                  {doc.file_type || 'TXT'}
                </span>
                <h3 className="text-base font-bold text-slate-800 truncate max-w-lg" title={doc.title}>
                  {doc.title}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {chunks.length} chunks extracted and embedded
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            {loading && (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                <svg className="animate-spin h-8 w-8 text-blue-600 mb-3" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <p className="text-sm">Fetching document chunks...</p>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm">
                {error}
              </div>
            )}

            {!loading && !error && chunks.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <svg className="w-12 h-12 mx-auto stroke-current mb-2" fill="none" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                  />
                </svg>
                <p className="text-sm font-medium text-slate-600">No chunks available for this document.</p>
                <p className="text-xs text-slate-400 mt-1">
                  The document may not have been processed yet or extraction resulted in no text.
                </p>
              </div>
            )}

            {!loading &&
              !error &&
              chunks.map((chunk) => (
                <div
                  key={chunk.chunk_index}
                  className="border border-slate-200 rounded-xl bg-slate-50/50 overflow-hidden shadow-2xs"
                >
                  <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">
                      Chunk #{chunk.chunk_index + 1}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-400 font-mono">
                        {chunk.character_count} chars
                      </span>
                      <button
                        onClick={() => handleCopy(chunk.content, chunk.chunk_index)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-700 hover:underline cursor-pointer"
                      >
                        {copiedIndex === chunk.chunk_index ? (
                          <>
                            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            <span className="text-emerald-600">Copied!</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.666 3.849A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.599m7.332 0c.055.194.084.4.084.61v.91m-7.416-.61c-.055.194-.084.4-.084.61v.91m0 0a2.25 2.25 0 002.25 2.25h3a2.25 2.25 0 002.25-2.25m-5.25 0h5.25m-7.5 4.5h9.75M4.5 10.5h15M6.75 19.5h10.5a2.25 2.25 0 002.25-2.25V10.5H4.5v6.75a2.25 2.25 0 002.25 2.25z"
                              />
                            </svg>
                            Copy text
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="p-4 bg-white">
                    <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap leading-relaxed select-text font-normal">
                      {chunk.content}
                    </pre>
                  </div>
                </div>
              ))}
          </div>

          {/* Footer */}
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg text-sm font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
