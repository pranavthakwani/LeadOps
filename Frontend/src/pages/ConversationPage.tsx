import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChatInterface } from '../components/chat/ChatInterface';
import { chatApi } from '../services/chatApi';

export const ConversationPage: React.FC = () => {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [resolvedConversationId, setResolvedConversationId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolveConversationId = async () => {
      if (!conversationId) {
        setLoading(false);
        return;
      }

      const id = parseInt(conversationId);
      console.log('🔍 Resolving conversation ID from URL:', id);

      // First, try to use it as a conversation_id directly
      try {
        const conversations = await chatApi.getConversations();
        const conversation = conversations.find(conv => conv.conversation_id === id);
        
        if (conversation) {
          console.log('✅ Found conversation by ID:', id);
          setResolvedConversationId(id);
        } else {
          // If not found as conversation_id, try to find it as contact_id and get the conversation_id
          console.log('❌ Conversation not found, trying as contact_id:', id);
          const contact = conversations.find(conv => conv.id === id);
          
          if (contact && contact.conversation_id) {
            console.log('✅ Found contact and resolved to conversation_id:', contact.conversation_id);
            setResolvedConversationId(contact.conversation_id);
          } else {
            console.log('❌ No conversation found for contact_id:', id);
            setResolvedConversationId(undefined);
          }
        }
      } catch (error) {
        console.error('Error resolving conversation ID:', error);
        setResolvedConversationId(undefined);
      } finally {
        setLoading(false);
      }
    };

    resolveConversationId();
  }, [conversationId]);

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading conversation...</div>;
  }

  return (
    <div className="flex h-full">
      <ChatInterface conversationId={resolvedConversationId} />
    </div>
  );
};
