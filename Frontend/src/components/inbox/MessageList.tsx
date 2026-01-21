import React from 'react';
import { MessageRow } from './MessageRow';
import { EmptyState } from '../common/EmptyState';
import type { Message } from '../../types/message';

interface MessageListProps {
  messages: Message[];
}

export const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  if (messages.length === 0) {
    return <EmptyState title="No messages found" description="Try adjusting your filters" />;
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => (
        <MessageRow key={message.id} message={message} />
      ))}
    </div>
  );
};
