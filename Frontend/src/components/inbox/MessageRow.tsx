import React from 'react';
import { useNavigate } from 'react-router-dom';
import { OfferingCard } from '../common/DetailCard';
import type { Message } from '../../types/message';

interface MessageRowProps {
  message: Message;
  currentTab?: string;
  currentTimeFilter?: string;
}

export const MessageRow: React.FC<MessageRowProps> = ({ message, currentTab = 'leads', currentTimeFilter = 'today' }) => {
  const navigate = useNavigate();

  const handleRowClick = (message: Message) => {
    // Always use the message route and pass type in state
    const apiUrl = `/message/${message.id}`;
    
    navigate(apiUrl, { 
      state: { 
        tab: currentTab,
        timeFilter: currentTimeFilter,
        messageType: message.classification,
        from: '/inbox' 
      } 
    });
  };

  // Use OfferingCard for leads and offerings (clickable)
  return <OfferingCard message={message} onClick={() => handleRowClick(message)} />;
};
