import React from 'react';

export default function ErrorBubble({ error, onRetry, onDismiss }) {
  if (!error) return null;

  return (
    <div className="flex items-start gap-3 my-4">
      <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs">
        !
      </div>
      <div className="bg-rose-50 border border-rose-200 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs max-w-xl text-rose-800 text-xs sm:text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-semibold text-rose-900">Request Error</p>
            <p className="text-rose-700 whitespace-pre-wrap leading-relaxed">{error}</p>
          </div>
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="text-rose-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
              title="Dismiss"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {onRetry && (
          <div className="mt-3 pt-2 border-t border-rose-200/60 flex items-center gap-2">
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
                />
              </svg>
              Retry
            </button>
            <span className="text-[11px] text-rose-600">The question was not saved. Click Retry to try again.</span>
          </div>
        )}
      </div>
    </div>
  );
}
