import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ClassificationBadge } from './ClassificationBadge';
import type { Message } from '../../types/message';
import { formatPhoneNumber } from '../../services/whatsapp';

interface MessageRowProps {
  message: Message;
}

export const MessageRow: React.FC<MessageRowProps> = ({ message }) => {
  const navigate = useNavigate();

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / 60000);

    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    }
  };

  return (
    <div
      onClick={() => navigate(`/message/${message.id}`)}
      className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-600 transition-all cursor-pointer"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <ClassificationBadge classification={message.classification} />
            <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto whitespace-nowrap">
              {formatTimestamp(message.timestamp)}
            </span>
          </div>

          {/* Parsed Data Display */}
          {message.parsedData && (
            <div className="space-y-2 mb-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                {message.parsedData.brand && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Brand:</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">{message.parsedData.brand}</span>
                  </div>
                )}
                {message.parsedData.model && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Model:</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">{message.parsedData.model}</span>
                  </div>
                )}
                {message.parsedData.ram && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">RAM:</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">{message.parsedData.ram}</span>
                  </div>
                )}
                {message.parsedData.storage && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Storage:</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">{message.parsedData.storage}</span>
                  </div>
                )}
                {message.parsedData.quantity && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Quantity:</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">{message.parsedData.quantity}</span>
                  </div>
                )}
                {message.parsedData.price && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Price:</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">
                      ₹{message.parsedData.price.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}
                {message.parsedData.gst && (
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">GST:</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">{message.parsedData.gst}</span>
                  </div>
                )}
                {message.parsedData.dispatch && (
                  <div className="col-span-2 md:col-span-3">
                    <span className="text-gray-500 dark:text-gray-400">Dispatch:</span>
                    <span className="font-medium text-gray-900 dark:text-white ml-1">{message.parsedData.dispatch}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Secondary Info */}
          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium">{message.sender}</span>
            <span>•</span>
            <span>{formatPhoneNumber(message.senderNumber)}</span>
            {message.detectedBrands.length > 0 && (
              <>
                <span>•</span>
                <span className="font-medium text-emerald-700 dark:text-emerald-400">
                  {message.detectedBrands.join(', ')}
                </span>
              </>
            )}
            <span>•</span>
            <span>{Math.round(message.confidence * 100)}% confidence</span>
          </div>
        </div>
      </div>
    </div>
  );
};
