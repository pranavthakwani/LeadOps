import React from 'react';
import { Search, Calendar } from 'lucide-react';

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
    <div className="backdrop-blur-md bg-white/70 dark:bg-[#151821]/70 border border-white/20 dark:border-white/10 rounded-2xl p-4 flex items-center gap-4 mb-6 shadow-sm">
      {/* Search Input */}
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
        <input
          type="text"
          placeholder="Search messages..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white/80 dark:bg-[#1c1f29]/80 border border-gray-200/50 dark:border-gray-700/50 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#128c7e] focus:ring-opacity-40 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all text-sm backdrop-blur-sm"
        />
      </div>

      {/* Time Filters */}
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
        <div className="flex gap-1 bg-white/50 dark:bg-[#1c1f29]/50 backdrop-blur-sm rounded-xl p-1">
          {(['today', '24h', 'week', 'month', 'all'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => onTimeFilterChange(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                timeFilter === filter
                  ? 'bg-[#128c7e]/20 text-[#128c7e] dark:bg-[#128c7e]/30 shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-[#2a2f3a]/60'
              }`}
            >
              {filter === '24h' ? '24h' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
