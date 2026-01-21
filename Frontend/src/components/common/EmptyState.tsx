import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <div className="mb-4 text-gray-400 dark:text-gray-500">
        {icon || <Inbox className="w-16 h-16" />}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>}
    </div>
  );
};
