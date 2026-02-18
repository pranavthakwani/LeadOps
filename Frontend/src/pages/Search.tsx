import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search as SearchIcon, Filter } from 'lucide-react';
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
    <div className="h-screen flex flex-col">
      <div className="p-8 flex-shrink-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Search</h1>
          <p className="text-gray-600 dark:text-gray-400">Search through all business products and messages</p>
        </div>

        {/* Search Input */}
        <div className="mb-6">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for products like 'tecno', 'iphone 15', or any keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Type:</span>
            <div className="flex gap-1">
              {(['leads', 'offerings'] as SearchFilterType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    filterType === type
                      ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Time Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Time:</span>
            <div className="flex gap-1">
              {(['all', 'today', '24h', 'week', 'month'] as TimeFilterType[]).map((time) => (
                <button
                  key={time}
                  onClick={() => setTimeFilter(time)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    timeFilter === time
                      ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {time === '24h' ? '24 Hrs' : time.charAt(0).toUpperCase() + time.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results Count */}
        {debouncedSearch && (
          <div className="mb-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {loading ? 'Searching...' : `Found ${filteredMessages.length} result${filteredMessages.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Loader key={i} type="message" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-600 dark:text-red-400">{error}</div>
        ) : !debouncedSearch ? (
          <div className="text-center py-12">
            <SearchIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Start Searching</h3>
            <p className="text-gray-600 dark:text-gray-400">Enter keywords to search through all products and messages</p>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center py-12">
            <SearchIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Results Found</h3>
            <p className="text-gray-600 dark:text-gray-400">Try adjusting your search terms or filters</p>
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
