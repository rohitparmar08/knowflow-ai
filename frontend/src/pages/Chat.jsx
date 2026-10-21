import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getConversations,
  getConversationDetail,
  updateConversationTitle,
  deleteConversation,
  askQuestion,
  getAllReadyDocuments,
} from '../api/chat';
import { getFolders } from '../api/documents';
import ChatSidebar from '../components/chat/ChatSidebar';
import MessageItem from '../components/chat/MessageItem';
import AskBox from '../components/chat/AskBox';
import ThinkingIndicator from '../components/chat/ThinkingIndicator';
import ErrorBubble from '../components/chat/ErrorBubble';

export default function Chat() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Sidebar & Data State
  const [conversations, setConversations] = useState([]);
  const [folders, setFolders] = useState([]);
  const [readyDocuments, setReadyDocuments] = useState([]);

  // Active Conversation State
  const [messages, setMessages] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isNotFound, setIsNotFound] = useState(false);

  // Scope State (defaults to 'all')
  const [scope, setScope] = useState({
    scopeType: 'all',
    folderId: null,
    documentIds: [],
  });

  // Ask Box & In-flight State
  const [isThinking, setIsThinking] = useState(false);
  const [errorDetail, setErrorDetail] = useState('');
  const [lastFailedQuestion, setLastFailedQuestion] = useState(null);

  // Mobile Slide-Over State
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Auto-scroll ref
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isThinking, errorDetail]);

  // Clear all chat state on user logout/switch
  useEffect(() => {
    setConversations([]);
    setMessages([]);
    setActiveConversation(null);
    setScope({ scopeType: 'all', folderId: null, documentIds: [] });
    setErrorDetail('');
  }, [user?.id]);

  // Load conversations list
  const fetchConversations = useCallback(async () => {
    try {
      const data = await getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, []);

  // Load folders & ready documents
  const loadPrerequisites = useCallback(async () => {
    try {
      const [foldersData, docsData] = await Promise.all([
        getFolders(),
        getAllReadyDocuments(),
      ]);
      setFolders(foldersData);
      setReadyDocuments(docsData);
    } catch (err) {
      console.error('Failed to load folders/ready docs:', err);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    loadPrerequisites();
  }, [fetchConversations, loadPrerequisites]);

  // Load conversation detail when conversationId changes
  useEffect(() => {
    if (!conversationId) {
      setActiveConversation(null);
      setMessages([]);
      setIsNotFound(false);
      setErrorDetail('');
      return;
    }

    let isMounted = true;
    async function loadDetail() {
      setIsLoadingDetail(true);
      setIsNotFound(false);
      setErrorDetail('');
      try {
        const data = await getConversationDetail(conversationId);
        if (isMounted) {
          setActiveConversation(data);
          setMessages(data.messages || []);
        }
      } catch (err) {
        if (isMounted) {
          if (err.response?.status === 404) {
            setIsNotFound(true);
          } else {
            setErrorDetail(
              err.response?.data?.detail || err.message || 'Failed to load conversation.'
            );
          }
        }
      } finally {
        if (isMounted) setIsLoadingDetail(false);
      }
    }

    loadDetail();
    return () => {
      isMounted = false;
    };
  }, [conversationId]);

  // Handle New Chat
  const handleNewChat = () => {
    setScope({ scopeType: 'all', folderId: null, documentIds: [] });
    setErrorDetail('');
    setLastFailedQuestion(null);
    navigate('/chat');
  };

  // Handle Select Conversation from list
  const handleSelectConversation = (id) => {
    navigate(`/chat/${id}`);
  };

  // Handle Rename
  const handleRenameConversation = async (id, newTitle) => {
    await updateConversationTitle(id, newTitle);
    if (activeConversation && String(activeConversation.id) === String(id)) {
      setActiveConversation((prev) => ({ ...prev, title: newTitle }));
    }
    await fetchConversations();
  };

  // Handle Delete
  const handleDeleteConversation = async (id) => {
    await deleteConversation(id);
    await fetchConversations();
    if (conversationId && String(conversationId) === String(id)) {
      navigate('/chat');
    }
  };

  // Handle Scope Change
  const handleScopeChange = ({ scopeType, folderId, documentIds }) => {
    setScope({ scopeType, folderId, documentIds });
  };

  // Handle Ask Question Submission
  const handleSendQuestion = async (questionText, isRetry = false) => {
    setErrorDetail('');

    // If not a retry, append optimistic user message
    if (!isRetry) {
      const optimisticMsg = {
        id: `optimistic-${Date.now()}`,
        role: 'user',
        content: questionText,
        sources: [],
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, optimisticMsg]);
    }

    setIsThinking(true);
    setLastFailedQuestion(questionText);

    try {
      const payload = {
        question: questionText,
        conversation_id: conversationId ? Number(conversationId) : null,
      };

      if (scope.scopeType === 'folder' && scope.folderId) {
        payload.folder_id = scope.folderId;
      } else if (scope.scopeType === 'documents' && scope.documentIds.length > 0) {
        payload.document_ids = scope.documentIds;
      }

      const res = await askQuestion(payload);

      // On successful response: replace optimistic message and append assistant message
      setMessages((prev) => {
        const withoutOptimistic = prev.filter(
          (m) => !String(m.id).startsWith('optimistic-')
        );
        return [...withoutOptimistic, res.user_message, res.assistant_message];
      });

      setLastFailedQuestion(null);
      await fetchConversations();

      // If new conversation was created, navigate to its URL
      if (!conversationId && res.conversation_id) {
        navigate(`/chat/${res.conversation_id}`, { replace: true });
      }
    } catch (err) {
      console.error('Ask Question Error:', err);
      const detail =
        err.response?.data?.detail ||
        (err.response?.data && typeof err.response.data === 'object'
          ? JSON.stringify(err.response.data)
          : null) ||
        (err.code === 'ECONNABORTED'
          ? 'Request timed out after 90 seconds. The model took too long to respond.'
          : 'Network error. Failed to communicate with the server.');

      setErrorDetail(detail);
    } finally {
      setIsThinking(false);
    }
  };

  const handleRetryFailed = () => {
    if (!lastFailedQuestion) return;
    handleSendQuestion(lastFailedQuestion, true);
  };

  return (
    <div className="flex h-[calc(100vh-8.5rem)] bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
      {/* Left Conversations Sidebar */}
      <ChatSidebar
        conversations={conversations}
        activeConversationId={conversationId}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onRenameConversation={handleRenameConversation}
        onDeleteConversation={handleDeleteConversation}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Chat Interface */}
      <section className="flex-1 flex flex-col min-w-0 bg-slate-50/30">
        {/* Top Chat Bar */}
        <header className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2 truncate">
            {/* Mobile Hamburger Drawer Trigger */}
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="md:hidden p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              title="Open Conversations"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>

            <div>
              <h2 className="text-sm font-bold text-slate-800 truncate max-w-md">
                {activeConversation ? activeConversation.title : 'New Chat'}
              </h2>
              <p className="text-[11px] text-slate-400">
                {activeConversation
                  ? `${messages.length} message${messages.length === 1 ? '' : 's'}`
                  : 'Ask anything based on your ingested documents'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New Chat
            </button>
          </div>
        </header>

        {/* 404 Conversation Not Found State */}
        {isNotFound ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
                />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">Conversation Not Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              This conversation does not exist or does not belong to your account.
            </p>
            <Link
              to="/chat"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs rounded-lg shadow-xs transition-colors"
            >
              Start a New Chat
            </Link>
          </div>
        ) : (
          <>
            {/* Scrollable Message History Area */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              {isLoadingDetail ? (
                <div className="flex items-center justify-center h-full text-slate-400 gap-2 text-xs">
                  <svg className="animate-spin h-5 w-5 text-blue-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Loading conversation history...</span>
                </div>
              ) : messages.length === 0 ? (
                /* Empty Chat Welcome State */
                <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl mb-3 shadow-2xs">
                    KF
                  </div>
                  <h3 className="text-base font-bold text-slate-800">Knowledge Assistant</h3>
                  <p className="text-xs text-slate-500 max-w-md mt-1 leading-relaxed">
                    Ask questions across your ingested documents. The assistant will retrieve relevant context chunks and cite its sources.
                  </p>

                  <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md w-full">
                    <button
                      onClick={() =>
                        handleSendQuestion('What are the key steps in document ingestion for a RAG system?')
                      }
                      className="p-3 text-left bg-white border border-slate-200 hover:border-blue-400 rounded-xl text-xs text-slate-700 hover:text-blue-700 shadow-2xs transition-colors cursor-pointer"
                    >
                      💡 "What are the key steps in document ingestion?"
                    </button>
                    <button
                      onClick={() =>
                        handleSendQuestion('Explain vector embeddings and cosine similarity search.')
                      }
                      className="p-3 text-left bg-white border border-slate-200 hover:border-blue-400 rounded-xl text-xs text-slate-700 hover:text-blue-700 shadow-2xs transition-colors cursor-pointer"
                    >
                      💡 "Explain vector embeddings and similarity search."
                    </button>
                  </div>
                </div>
              ) : (
                /* Message Bubbles List */
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <MessageItem key={msg.id} message={msg} />
                  ))}

                  {/* Thinking Indicator */}
                  {isThinking && <ThinkingIndicator />}

                  {/* Error Bubble */}
                  {errorDetail && (
                    <ErrorBubble
                      error={errorDetail}
                      onRetry={lastFailedQuestion ? handleRetryFailed : null}
                      onDismiss={() => setErrorDetail('')}
                    />
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Bottom Ask Box Area */}
            <div className="p-4 bg-white border-t border-slate-200">
              <AskBox
                folders={folders}
                readyDocuments={readyDocuments}
                scopeType={scope.scopeType}
                selectedFolderId={scope.folderId}
                selectedDocumentIds={scope.documentIds}
                onScopeChange={handleScopeChange}
                onSend={handleSendQuestion}
                isThinking={isThinking}
              />
            </div>
          </>
        )}
      </section>
    </div>
  );
}
