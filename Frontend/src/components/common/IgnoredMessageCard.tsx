import React from 'react';
import type { Message } from '../../types/message';

interface IgnoredMessageCardProps {
  message: Message;
}

export const IgnoredMessageCard: React.FC<IgnoredMessageCardProps> = ({ message }) => {
  return (
    <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
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
    </div>
  );
};
