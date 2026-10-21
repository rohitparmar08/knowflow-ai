import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ScopeSelector from './ScopeSelector';

export default function AskBox({
  folders = [],
  readyDocuments = [],
  scopeType = 'all',
  selectedFolderId = null,
  selectedDocumentIds = [],
  onScopeChange,
  onSend,
  isThinking = false,
}) {
  const [question, setQuestion] = useState('');
  const textareaRef = useRef(null);

  // Focus textarea when thinking finishes
  useEffect(() => {
    if (!isThinking && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isThinking]);

  const hasNoReadyDocs = readyDocuments.length === 0;

  const handleSubmit = (e) => {
    e?.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || isThinking) return;
    onSend(trimmed);
    setQuestion('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // If user has zero ready documents, show a notice with a link to /documents instead of ask box
  if (hasNoReadyDocs) {
    return (
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-center shadow-xs">
        <div className="w-10 h-10 mx-auto rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mb-2">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <h4 className="text-sm font-bold text-amber-900">No Ready Documents</h4>
        <p className="text-xs text-amber-700 mt-1 max-w-md mx-auto">
          You don't have any processed documents ready for question-answering. Upload your first document to start chatting with your knowledge base.
        </p>
        <Link
          to="/documents"
          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors"
        >
          Go to Documents Page
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </Link>
      </div>
    );
  }

  const charCount = question.length;
  const isNearLimit = charCount >= 1800;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-3">
      {/* Scope Selector above Ask Box */}
      <ScopeSelector
        folders={folders}
        readyDocuments={readyDocuments}
        scopeType={scopeType}
        selectedFolderId={selectedFolderId}
        selectedDocumentIds={selectedDocumentIds}
        onScopeChange={onScopeChange}
      />

      {/* Input Box Area */}
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          ref={textareaRef}
          rows={3}
          maxLength={2000}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your documents... (Press Enter to send, Shift+Enter for new line)"
          disabled={isThinking}
          className="w-full resize-none px-3 py-2 text-sm text-slate-800 placeholder-slate-400 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden disabled:bg-slate-50 transition-all leading-relaxed"
        />

        {/* Bottom bar inside form: Character counter & Send Button */}
        <div className="flex items-center justify-between pt-1 px-1">
          <div className="text-[11px] text-slate-400">
            {isNearLimit ? (
              <span className="font-semibold text-amber-600">
                {charCount}/2000 characters
              </span>
            ) : (
              <span>{charCount}/2000</span>
            )}
          </div>

          <button
            type="submit"
            disabled={!question.trim() || isThinking}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-colors cursor-pointer"
          >
            {isThinking ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Thinking...
              </>
            ) : (
              <>
                <span>Send</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
