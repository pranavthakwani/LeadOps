import React from 'react';
import { X } from 'lucide-react';

interface QuotedMessagePreviewProps {
  quotedText: string;
  quotedSender: string;
  onRemove?: () => void;
  onClick?: () => void;
  isInInput?: boolean; // To differentiate between input area and message bubble
}

export const QuotedMessagePreview: React.FC<QuotedMessagePreviewProps> = ({
  quotedText,
  quotedSender,
  onRemove,
  onClick,
  isInInput = false
}) => {
  const handleClick = (e: React.MouseEvent) => {
    if (onClick && !isInInput) {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div 
      className={`
        bg-gray-100 dark:bg-gray-800 rounded-lg p-2 mb-2 border-l-4 border-green-500
        ${onClick && !isInInput ? 'cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors' : ''}
      `}
      onClick={handleClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-gray-600 dark:text-gray-400 font-medium mb-1">
            Replying to {quotedSender}
          </div>
          <div className="text-sm text-gray-800 dark:text-gray-200 truncate">
            {quotedText}
          </div>
        </div>
        {onRemove && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="ml-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-3 h-3 text-gray-500 dark:text-gray-400" />
          </button>
        )}
      </div>
    </div>
  );
};
