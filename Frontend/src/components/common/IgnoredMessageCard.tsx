import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { Message } from '../../types/message';
import { formatISTDateTime } from '../../utils/timeUtils';

interface IgnoredMessageCardProps {
  message: Message;
  disableClick?: boolean;
}

export const IgnoredMessageCard: React.FC<IgnoredMessageCardProps> = ({ message, disableClick = false }) => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (disableClick) return; // Don't navigate if disabled
    
    navigate(`/message/${message.id}`, {
      state: {
        from: 'inbox',
        tab: 'ignored',
        messageType: 'ignored'
      }
    });
  };
  return (
    <div 
      onClick={disableClick ? undefined : handleClick}
      className={`bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 ${
        disableClick 
          ? '' 
          : 'hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-700 transition-all cursor-pointer group relative'
      }`}
    >
      {/* Header with sender info and timestamp */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <span className="text-gray-600 dark:text-gray-400 font-medium text-sm">
              {message.sender.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">
              {message.sender}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {message.senderNumber}
            </div>
          </div>
        </div>
        
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {formatISTDateTime(message.timestamp)}
        </div>
      </div>

      {/* Raw message content */}
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3">
        <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
          {message.rawMessage}
        </div>
      </div>

      {/* Ignored badge */}
      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium border border-gray-200 dark:border-gray-700">
            Ignored
          </span>
          {message.confidence && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Confidence: {Math.round(message.confidence * 100)}%
            </span>
          )}
        </div>
      </div>

      {/* Hover border glow - only when clickable */}
      {!disableClick && (
        <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none glow-soft" />
      )}
    </div>
  );
};
