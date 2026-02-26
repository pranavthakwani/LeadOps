import React from 'react';
import { Reply } from 'lucide-react';

interface QuoteButtonProps {
  onClick: () => void;
  className?: string;
}

export const QuoteButton: React.FC<QuoteButtonProps> = ({ onClick, className = '' }) => {
  return (
    <button
      onClick={onClick}
      className={`p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ${className}`}
      title="Reply to message"
    >
      <Reply className="w-4 h-4 text-gray-600 dark:text-gray-400" />
    </button>
  );
};
