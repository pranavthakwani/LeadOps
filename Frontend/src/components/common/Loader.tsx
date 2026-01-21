import React from 'react';
import { Loader2 } from 'lucide-react';
import { 
  SearchSkeleton, 
  MessageRowSkeleton, 
  DashboardSkeleton, 
  ContactsSkeleton, 
  SettingsSkeleton 
} from './Skeleton';

interface LoaderProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  type?: 'spinner' | 'search' | 'message' | 'dashboard' | 'contacts' | 'settings';
}

export const Loader: React.FC<LoaderProps> = ({ 
  size = 'md', 
  text, 
  type = 'spinner' 
}) => {
  // Return specific skeleton loaders for different screen types
  if (type === 'search') return <SearchSkeleton />;
  if (type === 'message') return <MessageRowSkeleton />;
  if (type === 'dashboard') return <DashboardSkeleton />;
  if (type === 'contacts') return <ContactsSkeleton />;
  if (type === 'settings') return <SettingsSkeleton />;

  // Default spinner loader
  const sizeStyles = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  return (
    <div className="flex flex-col items-center justify-center p-8">
      <Loader2 className={`${sizeStyles[size]} animate-spin text-emerald-600 dark:text-emerald-400`} />
      {text && <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{text}</p>}
    </div>
  );
};
