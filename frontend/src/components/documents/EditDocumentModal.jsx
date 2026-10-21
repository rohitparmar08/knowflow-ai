import React, { useState, useEffect } from 'react';

export default function EditDocumentModal({ isOpen, document: doc, folders = [], onClose, onSave }) {
  const [title, setTitle] = useState('');
  const [folderId, setFolderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (doc) {
      setTitle(doc.title || '');
      setFolderId(doc.folder !== null && doc.folder !== undefined ? String(doc.folder) : '');
      setError('');
    }
  }, [doc]);

  if (!isOpen || !doc) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Title cannot be empty.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onSave(doc.id, {
        title: trimmedTitle,
        folder: folderId === '' ? null : Number(folderId),
      });
      onClose();
    } catch (err) {
      const msg =
        err.response?.data?.title?.[0] ||
        err.response?.data?.folder?.[0] ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to update document.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={!loading ? onClose : undefined}
      />

      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-xl bg-white text-left shadow-2xl transition-all border border-slate-200">
          <form onSubmit={handleSubmit}>
            <div className="p-6">
              <h3 className="text-base font-bold text-slate-800 mb-4">Edit Document</h3>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Document Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Folder
                  </label>
                  <select
                    value={folderId}
                    onChange={(e) => setFolderId(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-800"
                  >
                    <option value="">(No folder / Unfiled)</option>
                    {folders.map((f) => (
                      <option key={f.id} value={String(f.id)}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-3 sm:flex sm:flex-row-reverse gap-2 border-t border-slate-100">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full justify-center rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-500 sm:w-auto disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={onClose}
                className="mt-3 inline-flex w-full justify-center rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-xs ring-1 ring-inset ring-slate-300 hover:bg-slate-50 sm:mt-0 sm:w-auto"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
