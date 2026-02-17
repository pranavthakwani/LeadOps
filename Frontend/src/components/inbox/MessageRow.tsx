import React from 'react';
import { useNavigate } from 'react-router-dom';
import { OfferingCard } from '../common/DetailCard';
import { IgnoredMessageCard } from '../common/IgnoredMessageCard';
import type { Message } from '../../types/message';

interface MessageRowProps {
  message: Message;
}

export const MessageRow: React.FC<MessageRowProps> = ({ message }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/message/${message.id}`);
  };

  // Use different card based on message classification
  if (message.classification === 'ignored') {
    // Ignored messages should not be clickable - return card without onClick
    return <IgnoredMessageCard message={message} onClick={undefined} />;
  }

  // Use OfferingCard for leads and offerings (clickable)
  return <OfferingCard message={message} onClick={handleClick} />;
};
