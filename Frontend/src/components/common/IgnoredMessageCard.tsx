import React from 'react';
import type { Message } from '../../types/message';

interface IgnoredMessageCardProps {
  message: Message;
  onClick?: () => void;
}

export const IgnoredMessageCard: React.FC<IgnoredMessageCardProps> = ({ message, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 transition-all ${
        onClick ? 'hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer' : 'cursor-default'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {/* Ignored Icon */}
          <div className="w-10 h-10 bg-gray-100 dark:bg-gray-900 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          
          <div>
            <h3 className="font-semibold text-sm text-gray-900 dark:text-white">
              Non-business Message
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Filtered by AI
            </p>
          </div>
        </div>
        
        {/* Classification Badge */}
        <span className="inline-flex items-center px-2 py-1 bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 rounded-full text-xs font-medium border border-gray-200 dark:border-gray-700">
          Ignored
        </span>
      </div>

      {/* Message Content */}
      <div className="mb-3">
        <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 leading-relaxed">
          {message.rawMessage || 'No message content'}
        </p>
      </div>

      {/* Sender Info */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">{message.sender}</span>
          <span>•</span>
          <span>{message.senderNumber}</span>
        </div>
        
        {/* Timestamp */}
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(message.timestamp).toLocaleDateString('en-IN', { 
            day: 'numeric', 
            month: 'short' 
          })} • {new Date(message.timestamp).toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          }).toLowerCase()}
        </div>
      </div>
    </div>
  );
};
