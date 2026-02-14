import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-gray-200 dark:bg-gray-800 rounded ${className}`} />
);

export const SearchSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
    <div className="divide-y divide-gray-200 dark:divide-gray-800">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-36" />
                  </div>
                  <Skeleton className="h-8 w-20 rounded" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const MessageRowSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-4 animate-pulse">
    <div className="flex items-center gap-8 pr-4">
      {/* Brand Logo Skeleton */}
      <div className="flex-shrink-0">
        <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
      </div>

      {/* Product Details Skeleton */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        
        {/* RAM/ROM Skeleton */}
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>

        {/* Additional Details Skeleton */}
        <div className="flex items-center gap-3">
          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>

      {/* Price + Quantity Skeleton */}
      <div className="flex-shrink-0 text-right mr-3">
        <div className="flex items-baseline justify-end gap-2">
          <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        
        {/* Date Skeleton */}
        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mt-1 ml-auto"></div>
      </div>
    </div>

    {/* Sender Info Skeleton */}
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
      <div className="flex items-center gap-2">
        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-3 w-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
        <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
      
      {/* Badge Skeleton */}
      <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
    </div>
  </div>
);

export const DashboardSkeleton: React.FC = () => (
  <div className="p-8 space-y-6">
    <div className="grid grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6 hover:shadow-lg transition-all cursor-pointer">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-900/50">
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

    <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <Skeleton className="h-4 w-48 mb-1" />
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div key={i} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/30 cursor-pointer transition-colors">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-16 rounded-full" />
                </div>
                <Skeleton className="h-4 w-full" />
              </div>
              <Skeleton className="h-4 w-12" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const ContactsSkeleton: React.FC = () => (
  <div className="p-8">
    <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
      </div>
      <div className="divide-y divide-gray-200 dark:divide-gray-800">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div key={i} className="p-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-24 mb-1" />
                <Skeleton className="h-4 w-36" />
              </div>
              <div className="text-right">
                <Skeleton className="h-4 w-16 mb-2" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const SettingsSkeleton: React.FC = () => (
  <div className="p-8">
    <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800">
      <div className="p-6 space-y-6">
        <div className="space-y-4">
          <div>
            <Skeleton className="h-4 w-24 mb-2" />
            <Skeleton className="h-10 w-64" />
          </div>
          <div>
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-10 w-48" />
          </div>
        </div>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-800 pt-6">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between">
              <div>
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-4 w-48" />
              </div>
              <Skeleton className="h-6 w-12 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);
