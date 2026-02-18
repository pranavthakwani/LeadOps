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

  const handleClick = () => {
    // Navigate with state to preserve current tab and time filter
    navigate(`/message/${message.id}`, { 
      state: { 
        tab: currentTab,
        timeFilter: currentTimeFilter,
        from: '/inbox' 
      } 
    });
  };

  // Use OfferingCard for leads and offerings (clickable)
  return <OfferingCard message={message} onClick={handleClick} />;
};
