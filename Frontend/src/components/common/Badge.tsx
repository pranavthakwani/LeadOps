import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  className = '',
}) => {
  const variantStyles = {
    success: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-400 border border-green-200 dark:border-green-800',
    warning: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800',
    error: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-400 border border-red-200 dark:border-red-800',
    info: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
    neutral: 'bg-gray-100 dark:bg-gray-900/50 text-gray-800 dark:text-gray-400 border border-gray-200 dark:border-gray-700',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
};
