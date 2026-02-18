import React from 'react';
import { Search } from 'lucide-react';

interface MessageFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  timeFilter: 'today' | '24h' | 'week' | 'month' | 'all';
  onTimeFilterChange: (filter: 'today' | '24h' | 'week' | 'month' | 'all') => void;
}

export const MessageFilters: React.FC<MessageFiltersProps> = ({
  searchQuery,
  onSearchChange,
  timeFilter,
  onTimeFilterChange,
}) => {
  return (
    <div className="flex items-center gap-4 mb-6">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500" />
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:focus:ring-emerald-400 focus:border-transparent placeholder-gray-500 dark:placeholder-gray-400"
        />
      </div>

      <div className="flex gap-2">
        {(['today', '24h', 'week', 'month', 'all'] as const).map((filter) => (
          <button
            key={filter}
            onClick={() => onTimeFilterChange(filter)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              timeFilter === filter
                ? 'bg-emerald-600 dark:bg-emerald-700 text-white'
                : 'bg-white dark:bg-gray-950 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900'
            }`}
          >
            {filter === '24h' ? '24 Hours' : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
};
