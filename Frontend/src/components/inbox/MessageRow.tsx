import React from 'react';
import { useNavigate } from 'react-router-dom';
import { OfferingCard } from '../common/DetailCard';
import type { Message } from '../../types/message';

interface MessageRowProps {
  message: Message;
}

export const MessageRow: React.FC<MessageRowProps> = ({ message }) => {
  const navigate = useNavigate();

  return (
    <OfferingCard 
      message={message}
      onClick={() => navigate(`/message/${message.id}`)}
    />
  );
};
