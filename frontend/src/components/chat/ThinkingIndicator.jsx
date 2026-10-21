import React from 'react';

export default function ThinkingIndicator() {
  return (
    <div className="flex items-start gap-3 my-4">
      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs">
        AI
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-xs px-4 py-3 shadow-xs max-w-xl text-slate-600 text-sm flex items-center gap-3">
        <span className="font-medium text-slate-700 text-xs">Thinking</span>
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.3s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:-0.15s]" />
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-bounce" />
        </div>
      </div>
    </div>
  );
}
