import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageList } from '../components/inbox/MessageList';
import { MessageFilters } from '../components/inbox/MessageFilters';
import { Loader } from '../components/common/Loader';
import { useMessages } from '../hooks/useMessages';
import { useDebounce } from '../hooks/useDebounce';
import type { Classification } from '../types/message';

const TABS: { value: Classification; label: string }[] = [
  { value: 'lead', label: 'Leads' },
  { value: 'offering', label: 'Offerings' },
  { value: 'ignored', label: 'Ignored' },
];

export const Inbox: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as Classification) || 'lead';
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'today' | '24h' | 'all'>('all');
  const debouncedSearch = useDebounce(searchQuery);

  const { messages, loading, error } = useMessages(activeTab);

  const filteredMessages = useMemo(() => {
    let filtered = messages;

    if (timeFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter((msg) => new Date(msg.timestamp) >= today);
    } else if (timeFilter === '24h') {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      filtered = filtered.filter((msg) => new Date(msg.timestamp) >= last24h);
    }

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(
        (msg) =>
          msg.sender.toLowerCase().includes(query) ||
          msg.preview.toLowerCase().includes(query) ||
          msg.senderNumber.includes(query) ||
          msg.detectedBrands.some((brand) => brand.toLowerCase().includes(query))
      );
    }

    return filtered;
  }, [messages, timeFilter, debouncedSearch]);

  const setActiveTab = (tab: Classification) => {
    setSearchParams({ tab });
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="p-8 flex-shrink-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Inbox</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your WhatsApp messages</p>
        </div>

        <div className="mb-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-6 py-3 font-medium transition-colors relative ${
                  activeTab === tab.value
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
                {activeTab === tab.value && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600 dark:bg-emerald-400"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        <MessageFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          timeFilter={timeFilter}
          onTimeFilterChange={setTimeFilter}
        />
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Loader key={i} type="message" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-600 dark:text-red-400">{error}</div>
        ) : (
          <MessageList messages={filteredMessages} />
        )}
      </div>
    </div>
  );
};
