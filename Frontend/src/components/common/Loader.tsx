import React from 'react';
import { 
  SearchSkeleton, 
  MessageRowSkeleton, 
  DashboardSkeleton, 
  ContactsSkeleton, 
  SettingsSkeleton,
  InboxSkeleton,
  ChatMessageSkeleton,
  Skeleton
} from './Skeleton';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  type?: 'spinner' | 'search' | 'message' | 'dashboard' | 'contacts' | 'settings' | 'inbox' | 'chat';
  count?: number;
}

export const Loader: React.FC<LoaderProps> = ({ 
  size = 'md', 
  text, 
  type = 'spinner',
  count = 1
}) => {
  // Return specific skeleton loaders for different screen types
  switch (type) {
    case 'search':
      return <SearchSkeleton />;
    case 'message':
      return (
        <div className="space-y-3">
          {Array.from({ length: count }).map((_, i) => (
            <MessageRowSkeleton key={i} />
          ))}
        </div>
      );
    case 'dashboard':
      return <DashboardSkeleton />;
    case 'contacts':
      return <ContactsSkeleton />;
    case 'settings':
      return <SettingsSkeleton />;
    case 'inbox':
      return <InboxSkeleton />;
    case 'chat':
      return <ChatMessageSkeleton />;
    default:
      // Skeleton loader for default - no spinners allowed
      return (
        <div className="flex flex-col items-center justify-center p-8 space-y-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-4 h-4 rounded-full" />
            <Skeleton className="w-3 h-3 rounded-full" />
            <Skeleton className="w-2 h-2 rounded-full" />
          </div>
          {text && <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">{text}</p>}
        </div>
      );
  }
};

// Skeleton-only loader component - use this for all loading states
export const SkeletonLoader: React.FC<{ 
  type: 'card' | 'text' | 'avatar' | 'button' | 'input';
  lines?: number;
  className?: string;
}> = ({ type, lines = 1, className = '' }) => {
  switch (type) {
    case 'card':
      return (
        <div className={`bg-white/80 dark:bg-[#151821]/80 backdrop-blur-sm rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50 shadow-sm ${className}`}>
          <div className="flex items-center gap-4">
            <Skeleton className="w-14 h-14 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </div>
      );
    case 'text':
      return (
        <div className={`space-y-2 ${className}`}>
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton key={i} className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
          ))}
        </div>
      );
    case 'avatar':
      return <Skeleton className={`w-10 h-10 rounded-full ${className}`} />;
    case 'button':
      return <Skeleton className={`h-10 w-24 rounded-xl ${className}`} />;
    case 'input':
      return <Skeleton className={`h-12 w-full rounded-xl ${className}`} />;
    default:
      return <Skeleton className={className} />;
  }
};
