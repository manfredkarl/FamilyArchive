'use client';

import MessageList from './components/MessageList';
import ChatInput from './components/ChatInput';
import { useChat } from './hooks/useChat';

export default function Home() {
  const { messages, isLoading, sendMessage, clearConversation } = useChat();

  return (
    <div className="flex h-screen flex-col bg-white">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-900">
          spec2cloud App
        </h1>
        <button
          type="button"
          onClick={clearConversation}
          aria-label="New Conversation"
          tabIndex={3}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          New Conversation
        </button>
      </header>

      {/* Messages */}
      <MessageList messages={messages} isLoading={isLoading} />

      {/* Input */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
