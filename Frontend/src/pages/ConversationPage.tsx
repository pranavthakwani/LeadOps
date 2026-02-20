import React from 'react';
import { useParams } from 'react-router-dom';
import { ChatInterface } from '../components/chat/ChatInterface';

export const ConversationPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  
  return (
    <div className="flex h-full">
      <ChatInterface conversationId={conversationId ? parseInt(conversationId) : undefined} />
    </div>
  );
};
