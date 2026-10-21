import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { formatDate } from '../../utils/formatters';

const FALLBACK_TEXT = "I couldn't find anything relevant in your documents.";

export default function MessageItem({ message }) {
  const isUser = message.role === 'user';
  const isFallback = !isUser && message.content?.trim() === FALLBACK_TEXT;
  const sources = message.sources || [];
  const hasSources = sources.length > 0;

  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [highlightedSourceIndex, setHighlightedSourceIndex] = useState(null);

  // Map available source indices for citation matching
  const availableSourceIndices = useMemo(() => {
    return new Set(sources.map((s) => Number(s.index)));
  }, [message.sources]);

  // Transform citations in markdown text into custom anchor links: [n] or [1, 2]
  // Unmatched citations remain plain text.
  const processedContent = useMemo(() => {
    if (isUser || !message.content) return message.content || '';

    // Match patterns like [1], [2], [1, 3] or [1,2,3]
    return message.content.replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (match, inner) => {
      const parts = inner.split(',').map((p) => p.trim());
      const transformed = parts.map((part) => {
        const num = parseInt(part, 10);
        if (availableSourceIndices.has(num)) {
          return `[[${num}]](#cite-${message.id}-${num})`;
        }
        return `[${part}]`;
      });
      return transformed.join(', ');
    });
  }, [message.content, message.id, isUser, availableSourceIndices]);

  // Click handler for citation chips
  const handleCitationClick = (sourceIndex) => {
    setSourcesOpen(true);
    setHighlightedSourceIndex(sourceIndex);

    setTimeout(() => {
      const cardId = `source-card-${message.id}-${sourceIndex}`;
      const cardElem = document.getElementById(cardId);
      if (cardElem) {
        cardElem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 60);

    setTimeout(() => {
      setHighlightedSourceIndex(null);
    }, 2500);
  };

  // User message bubble (right aligned)
  if (isUser) {
    return (
      <div className="flex justify-end my-4">
        <div className="flex items-end gap-2 max-w-xl">
          <div className="bg-blue-600 text-white rounded-2xl rounded-br-xs px-4 py-3 shadow-xs text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
            <div className="text-[10px] text-blue-200 text-right mt-1 font-mono">
              {formatDate(message.created_at)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Assistant message bubble (left aligned)
  return (
    <div className="flex items-start gap-3 my-4 group">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-xs mt-1">
        KF
      </div>

      <div className="max-w-2xl flex-1">
        {/* Main Content Box */}
        <div
          className={`rounded-2xl rounded-tl-xs px-5 py-4 shadow-xs text-sm leading-relaxed ${
            isFallback
              ? 'bg-slate-50 border border-slate-200 text-slate-500 italic'
              : 'bg-white border border-slate-200 text-slate-800'
          }`}
        >
          {isFallback ? (
            <p className="not-italic text-slate-600 font-medium">{message.content}</p>
          ) : (
            <div className="prose prose-slate prose-sm max-w-none text-slate-800 space-y-2">
              <ReactMarkdown
                components={{
                  a: ({ href, children }) => {
                    if (href && href.startsWith(`#cite-${message.id}-`)) {
                      const idxStr = href.replace(`#cite-${message.id}-`, '');
                      const sIndex = parseInt(idxStr, 10);
                      return (
                        <button
                          type="button"
                          onClick={() => handleCitationClick(sIndex)}
                          className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-300 transition-colors cursor-pointer align-baseline"
                          title={`Jump to Source [${sIndex}]`}
                        >
                          [{sIndex}]
                        </button>
                      );
                    }
                    return (
                      <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">
                        {children}
                      </a>
                    );
                  },
                }}
              >
                {processedContent}
              </ReactMarkdown>
            </div>
          )}

          <div className="text-[10px] text-slate-400 mt-3 flex items-center justify-between border-t border-slate-100 pt-2 font-mono">
            <span>Assistant</span>
            <span>{formatDate(message.created_at)}</span>
          </div>
        </div>

        {/* Collapsible Sources List */}
        {hasSources && (
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => setSourcesOpen(!sourcesOpen)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700 bg-slate-100/80 hover:bg-slate-200/80 px-2.5 py-1 rounded-md transition-colors cursor-pointer"
            >
              <svg
                className={`w-3.5 h-3.5 text-slate-500 transition-transform ${sourcesOpen ? 'rotate-90' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2.5"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
              <span>Sources ({sources.length})</span>
            </button>

            {sourcesOpen && (
              <div className="mt-2 space-y-2 pl-2">
                {sources.map((source) => {
                  const isHighlighted = highlightedSourceIndex === source.index;
                  return (
                    <div
                      key={source.index}
                      id={`source-card-${message.id}-${source.index}`}
                      className={`p-3 rounded-xl border text-xs transition-all ${
                        isHighlighted
                          ? 'ring-2 ring-blue-500 bg-blue-50/70 border-blue-400 shadow-sm'
                          : 'bg-white border-slate-200 shadow-2xs hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 truncate">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-600 text-white">
                            [{source.index}]
                          </span>
                          <span className="font-semibold text-slate-800 truncate" title={source.document_title}>
                            📄 {source.document_title}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono flex-shrink-0">
                          Chunk #{source.chunk_index + 1}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 font-mono whitespace-pre-wrap leading-relaxed">
                        {source.snippet}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
