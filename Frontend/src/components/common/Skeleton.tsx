import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200/80 dark:bg-[#1c1f29]/80 rounded-xl backdrop-blur-sm ${className}`} />
);

export const SkeletonPulse: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse ${className}`} />
);

// Dashboard Skeleton
export const DashboardSkeleton: React.FC = () => (
  <div className="p-8 space-y-6">
    {/* Stat Cards */}
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div 
          key={i} 
          className="bg-white/80 dark:bg-[#151821]/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-xl bg-gray-100/80 dark:bg-[#1c1f29]/80 backdrop-blur-sm">
              <Skeleton className="h-6 w-6" />
            </div>
          </div>
          <div>
            <Skeleton className="h-8 w-20 mb-1" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>

    {/* Brand Offerings Card */}
    <div className="bg-white/80 dark:bg-[#151821]/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 shadow-sm">
      <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
        <Skeleton className="h-6 w-48" />
      </div>
      <div className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-7 h-7 rounded-full" />
              <div className="flex-1">
                <div className="flex items-center gap-5">
                  <Skeleton className="w-14 h-14 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-5 w-20" />
                      <Skeleton className="h-4 w-24" />
                    </div>
                    <Skeleton className="h-3 w-32" />
                  </div>
                  <div className="text-right space-y-2">
                    <Skeleton className="h-6 w-24" />
                    <Skeleton className="h-3 w-16 ml-auto" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// Search Skeleton
export const SearchSkeleton: React.FC = () => (
  <div className="space-y-3">
    {/* Search Input Skeleton */}
    <Skeleton className="h-14 w-full rounded-2xl mb-6" />
    
    {/* Filters Skeleton */}
    <Skeleton className="h-16 w-full rounded-2xl mb-6" />
    
    {/* Results */}
    {[1, 2, 3, 4, 5].map((i) => (
      <div 
        key={i} 
        className="bg-white/80 dark:bg-[#151821]/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-4 shadow-sm"
      >
        <div className="flex items-start gap-5">
          <Skeleton className="w-14 h-14 rounded-xl flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// Message Row Skeleton
export const MessageRowSkeleton: React.FC = () => (
  <div className="bg-white/80 dark:bg-[#151821]/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-4 shadow-sm">
    <div className="flex items-center gap-5">
      {/* Brand Logo Skeleton */}
      <Skeleton className="w-14 h-14 rounded-xl flex-shrink-0" />

      {/* Product Details Skeleton */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-3 w-32" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>

      {/* Price + Quantity Skeleton */}
      <div className="flex-shrink-0 text-right space-y-2">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
    </div>

    {/* Sender Info Skeleton */}
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100/50 dark:border-gray-700/50">
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-4" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
  </div>
);

// Contacts Skeleton
export const ContactsSkeleton: React.FC = () => (
  <div className="space-y-3">
    {/* Search Skeleton */}
    <Skeleton className="h-12 w-full rounded-2xl mb-4" />
    
    {/* Contact Items */}
    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
      <div 
        key={i} 
        className="bg-white/80 dark:bg-[#151821]/80 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-4 shadow-sm"
      >
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      </div>
    ))}
  </div>
);

// Settings Skeleton
export const SettingsSkeleton: React.FC = () => (
  <div className="space-y-6">
    {[1, 2].map((card) => (
      <div 
        key={card}
        className="bg-white/80 dark:bg-[#151821]/80 backdrop-blur-sm rounded-2xl border border-gray-200/50 dark:border-gray-700/50 p-6 shadow-sm"
      >
        <div className="flex items-center gap-2 mb-5">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <Skeleton className="h-5 w-32" />
        </div>
        
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between py-2">
              <div className="space-y-1">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// Inbox Skeleton
export const InboxSkeleton: React.FC = () => (
  <div className="space-y-4">
    {/* Tabs Skeleton */}
    <Skeleton className="h-12 w-64 rounded-2xl" />
    
    {/* Filter Skeleton */}
    <Skeleton className="h-16 w-full rounded-2xl mb-6" />
    
    {/* Message List */}
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <MessageRowSkeleton key={i} />
      ))}
    </div>
  </div>
);

// Chat Message Skeleton
export const ChatMessageSkeleton: React.FC = () => (
  <div className="space-y-4 px-4">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
        <div 
          className={`max-w-[70%] p-3 rounded-2xl ${
            i % 2 === 0 
              ? 'bg-[#d9fdd3] dark:bg-[#005c4b]' 
              : 'bg-white dark:bg-[#202c33]'
          }`}
        >
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-3 w-16 ml-auto" />
        </div>
      </div>
    ))}
  </div>
);
