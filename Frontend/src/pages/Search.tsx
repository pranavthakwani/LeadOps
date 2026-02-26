import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Filter, Sparkles } from 'lucide-react';
import { MessageRow } from '../components/inbox/MessageRow';
import { Loader } from '../components/common/Loader';
import { useDebounce } from '../hooks/useDebounce';
import { useSearchMessages } from '../hooks/useSearchMessages';
import type { Message } from '../types/message';

type SearchFilterType = 'leads' | 'offerings';
type TimeFilterType = 'today' | '24h' | 'week' | 'month' | 'all';

export const Search: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<SearchFilterType>('leads');
  const [timeFilter, setTimeFilter] = useState<TimeFilterType>('all');
  const debouncedSearch = useDebounce(searchQuery, 300);

  const { messages, loading, error } = useSearchMessages(debouncedSearch, filterType, timeFilter);

  const filteredMessages = useMemo(() => {
    if (!messages.length) return [];

    let filtered = messages;

    // Apply time filter (this is redundant since backend already filters, but keeping for consistency)
    if (timeFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter((msg: Message) => new Date(msg.timestamp) >= today);
    } else if (timeFilter === '24h') {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      filtered = filtered.filter((msg: Message) => new Date(msg.timestamp) >= last24h);
    } else if (timeFilter === 'week') {
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((msg: Message) => new Date(msg.timestamp) >= lastWeek);
    } else if (timeFilter === 'month') {
      const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((msg: Message) => new Date(msg.timestamp) >= lastMonth);
    }

    return filtered;
  }, [messages, timeFilter]);

  const handleMessageClick = (messageId: string) => {
    navigate(`/message/${messageId}`, { state: { from: '/search' } });
  };

  return (
    <div className="h-screen flex flex-col items-center">
      {/* Constrained width container */}
      <div className="w-full max-w-[900px] px-8 py-8 flex-shrink-0">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2 tracking-tight">
            Search
          </h1>
          <p className="text-[var(--text-secondary)]">
            Search through all business products and messages
          </p>
        </div>

        {/* Search Input - Floating pill with transparency */}
        <div className="mb-6 relative">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
            <SearchIcon className="w-5 h-5 text-gray-400 dark:text-gray-500" />
          </div>
          <input
            type="text"
            placeholder="Search for products like 'tecno', 'iphone 15', or any keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white/80 dark:bg-[#151821]/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 text-gray-900 dark:text-white rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#128c7e] focus:ring-opacity-40 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all text-base"
          />
          {/* Subtle glow effect behind icon */}
          {!debouncedSearch && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 -ml-2.5 -mt-5 bg-[#128c7e]/10 rounded-full blur-xl pointer-events-none" />
          )}
        </div>

        {/* Filters - Frosted translucent container */}
        <div className="backdrop-blur-md bg-white/70 dark:bg-[#151821]/70 border border-white/20 dark:border-white/10 rounded-2xl p-4 mb-6 shadow-sm">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Type:</span>
              <div className="flex gap-1 bg-white/50 dark:bg-[#1c1f29]/50 backdrop-blur-sm rounded-xl p-1">
                {(['leads', 'offerings'] as SearchFilterType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      filterType === type
                        ? 'bg-[#128c7e]/20 text-[#128c7e] dark:bg-[#128c7e]/30 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-[#2a2f3a]/60'
                    }`}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Time:</span>
              <div className="flex gap-1 bg-white/50 dark:bg-[#1c1f29]/50 backdrop-blur-sm rounded-xl p-1">
                {(['all', 'today', '24h', 'week', 'month'] as TimeFilterType[]).map((time) => (
                  <button
                    key={time}
                    onClick={() => setTimeFilter(time)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                      timeFilter === time
                        ? 'bg-[#128c7e]/20 text-[#128c7e] dark:bg-[#128c7e]/30 shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-white/60 dark:hover:bg-[#2a2f3a]/60'
                    }`}
                  >
                    {time === '24h' ? '24h' : time.charAt(0).toUpperCase() + time.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Results Count */}
        {debouncedSearch && (
          <div className="mb-4">
            <p className="text-sm text-[var(--text-secondary)]">
              {loading ? 'Searching...' : `Found ${filteredMessages.length} result${filteredMessages.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto w-full max-w-[900px] px-8 pb-8">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Loader key={i} type="message" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500">{error}</div>
        ) : !debouncedSearch ? (
          <div className="text-center py-16">
            <div className="relative inline-block mb-6">
              <SearchIcon className="w-16 h-16 text-[var(--text-tertiary)]/30" />
              {/* Animated glow behind icon */}
              <div className="absolute inset-0 bg-[var(--accent-primary)]/20 rounded-full blur-2xl animate-pulse" />
            </div>
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
              Start Searching
            </h3>
            <p className="text-[var(--text-secondary)]">
              Enter keywords to search through all products and messages
            </p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center py-16">
            <Sparkles className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--text-primary)] mb-2">
              No Results Found
            </h3>
            <p className="text-[var(--text-secondary)]">
              Try adjusting your search terms or filters
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((message: Message) => (
              <div 
                key={message.id} 
                onClick={() => handleMessageClick(message.id)}
                className="cursor-pointer"
              >
                <MessageRow 
                  message={message} 
                  currentTab={filterType} 
                  currentTimeFilter={timeFilter} 
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
