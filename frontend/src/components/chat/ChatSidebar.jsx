import React, { useState } from 'react';
import { formatRelativeTime } from '../../utils/formatters';
import ConfirmDialog from '../documents/ConfirmDialog';

export default function ChatSidebar({
  conversations = [],
  activeConversationId,
  onSelectConversation,
  onNewChat,
  onRenameConversation,
  onDeleteConversation,
  isOpenMobile = false,
  onCloseMobile,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [isSubmittingRename, setIsSubmittingRename] = useState(false);
  const [renameError, setRenameError] = useState('');

  const [deletingConversation, setDeletingConversation] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Start inline rename
  const handleStartRename = (conv, e) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
    setRenameError('');
  };

  // Submit rename
  const handleRenameSubmit = async (convId, e) => {
    e?.preventDefault();
    const trimmed = editTitle.trim();
    if (!trimmed) {
      setRenameError('Title cannot be empty.');
      return;
    }
    setRenameError('');
    setIsSubmittingRename(true);
    try {
      await onRenameConversation(convId, trimmed);
      setEditingId(null);
    } catch (err) {
      const msg =
        err.response?.data?.title?.[0] ||
        err.response?.data?.detail ||
        err.message ||
        'Failed to rename conversation.';
      setRenameError(msg);
    } finally {
      setIsSubmittingRename(false);
    }
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!deletingConversation) return;
    setIsDeleting(true);
    try {
      await onDeleteConversation(deletingConversation.id);
      setDeletingConversation(null);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete conversation.');
    } finally {
      setIsDeleting(false);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Top Header & New Chat Button */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-2">
        <button
          onClick={() => {
            onNewChat();
            if (onCloseMobile) onCloseMobile();
          }}
          className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Chat
        </button>

        {/* Mobile close button */}
        {onCloseMobile && (
          <button
            onClick={onCloseMobile}
            className="md:hidden p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Conversations List Header */}
      <div className="px-4 py-2 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <span>Conversations</span>
        <span>{conversations.length}</span>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {conversations.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400">
            <svg className="w-8 h-8 mx-auto stroke-current mb-2 opacity-50" fill="none" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
            <p className="text-xs font-medium text-slate-500">No conversations yet</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Start by asking your first question.</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = String(activeConversationId) === String(conv.id);
            const isEditing = editingId === conv.id;

            if (isEditing) {
              return (
                <div key={conv.id} className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <input
                    type="text"
                    autoFocus
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit(conv.id, e);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    className="w-full px-2 py-1 text-xs bg-white border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                  />
                  {renameError && <p className="text-[10px] text-rose-600 mt-1 font-medium">{renameError}</p>}
                  <div className="flex justify-end gap-1.5 mt-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-200 rounded"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSubmittingRename || !editTitle.trim()}
                      onClick={(e) => handleRenameSubmit(conv.id, e)}
                      className="px-2 py-0.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded cursor-pointer"
                    >
                      {isSubmittingRename ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={conv.id}
                onClick={() => {
                  onSelectConversation(conv.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                className={`group flex items-center justify-between p-2.5 rounded-lg text-xs transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-blue-50 text-blue-800 font-semibold border border-blue-100 shadow-2xs'
                    : 'text-slate-700 hover:bg-slate-50 border border-transparent'
                }`}
              >
                <div className="truncate flex-1 min-w-0 pr-2">
                  <span className="truncate block font-medium" title={conv.title}>
                    {conv.title}
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    {formatRelativeTime(conv.updated_at)}
                  </span>
                </div>

                {/* Actions (visible on hover or when active) */}
                <div className={`${isActive ? 'flex' : 'hidden group-hover:flex'} items-center gap-0.5 flex-shrink-0`}>
                  <button
                    onClick={(e) => handleStartRename(conv, e)}
                    title="Rename conversation"
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-100/70 rounded transition-colors"
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
                      setDeletingConversation(conv);
                    }}
                    title="Delete conversation"
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-100/70 rounded transition-colors"
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
              </div>
            );
          })
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deletingConversation)}
        title="Delete Conversation"
        message={`Are you sure you want to delete "${deletingConversation?.title}"?\nAll messages in this conversation will be permanently removed.`}
        confirmText="Delete Conversation"
        confirmVariant="danger"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingConversation(null)}
      />
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:block w-72 flex-shrink-0 h-full">{sidebarContent}</aside>

      {/* Mobile Slide-Over Drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="fixed inset-y-0 left-0 w-80 max-w-full shadow-2xl z-10">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
