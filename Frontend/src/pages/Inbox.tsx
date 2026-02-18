import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { MessageList } from '../components/inbox/MessageList';
import { MessageFilters } from '../components/inbox/MessageFilters';
import { IgnoredMessageList } from '../components/inbox/IgnoredMessageList';
import { Loader } from '../components/common/Loader';
import { useMessages } from '../hooks/useMessages';
import { useIgnoredMessages } from '../hooks/useIgnoredMessages';
import { useDebounce } from '../hooks/useDebounce';

type TabType = 'leads' | 'offerings' | 'ignored';

export const Inbox: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('leads');
  const [searchQuery, setSearchQuery] = useState('');
  const [timeFilter, setTimeFilter] = useState<'today' | '24h' | 'week' | 'month' | 'all'>('today');
  const debouncedSearch = useDebounce(searchQuery);

  // Set active tab and time filter from URL query parameter on component mount
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const timeParam = searchParams.get('timeFilter');
    
    if (tabParam === 'lead' || tabParam === 'leads') {
      setActiveTab('leads');
    } else if (tabParam === 'offering' || tabParam === 'offerings') {
      setActiveTab('offerings');
    } else if (tabParam === 'ignored') {
      setActiveTab('ignored');
    }

    // Only preserve time filter if coming from message detail (has state)
    // Otherwise, reset to today for manual tab changes
    const isFromMessageDetail = (location.state as any)?.from === '/inbox';
    if (timeParam && ['today', '24h', 'week', 'month', 'all'].includes(timeParam) && isFromMessageDetail) {
      setTimeFilter(timeParam as any);
    } else if (!isFromMessageDetail) {
      setTimeFilter('today'); // Reset to today for manual tab changes
    }
  }, [searchParams, location.state]);

  const { messages, loading: messagesLoading, error: messagesError } = useMessages();
  const { messages: ignoredMessages, loading: ignoredLoading, error: ignoredError } = useIgnoredMessages();

  const filteredMessages = useMemo(() => {
    let filtered = messages;

    // Filter by classification based on active tab
    if (activeTab === 'leads') {
      filtered = filtered.filter((msg) => msg.classification === 'lead');
    } else if (activeTab === 'offerings') {
      filtered = filtered.filter((msg) => msg.classification === 'offering');
    }

    if (timeFilter === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filtered = filtered.filter((msg) => new Date(Number(msg.timestamp)) >= today);
    } else if (timeFilter === '24h') {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      filtered = filtered.filter((msg) => new Date(Number(msg.timestamp)) >= last24h);
    } else if (timeFilter === 'week') {
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((msg) => new Date(Number(msg.timestamp)) >= lastWeek);
    } else if (timeFilter === 'month') {
      const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((msg) => new Date(Number(msg.timestamp)) >= lastMonth);
    }

    if (debouncedSearch && activeTab !== 'ignored') {
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
  }, [messages, timeFilter, debouncedSearch, activeTab]);

  const filteredIgnoredMessages = useMemo(() => {
    if (activeTab !== 'ignored') return [];
    
    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      return ignoredMessages.filter(
        (msg) =>
          msg.sender.toLowerCase().includes(query) ||
          msg.rawMessage.toLowerCase().includes(query) ||
          msg.senderNumber.includes(query)
      );
    }
    
    return ignoredMessages;
  }, [ignoredMessages, debouncedSearch, activeTab]);

  const getCurrentLoading = () => {
    return activeTab === 'ignored' ? ignoredLoading : messagesLoading;
  };

  const getCurrentError = () => {
    return activeTab === 'ignored' ? ignoredError : messagesError;
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="p-8 flex-shrink-0">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Inbox</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your WhatsApp messages</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6">
          <button
            onClick={() => setActiveTab('leads')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'leads'
                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            Leads
          </button>
          <button
            onClick={() => setActiveTab('offerings')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'offerings'
                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            Offerings
          </button>
          <button
            onClick={() => setActiveTab('ignored')}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              activeTab === 'ignored'
                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
            }`}
          >
            Ignored
          </button>
        </div>

        {/* Filters - only show for leads and offerings */}
        {activeTab !== 'ignored' && (
          <MessageFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            timeFilter={timeFilter}
            onTimeFilterChange={setTimeFilter}
          />
        )}

        {/* Search for ignored messages */}
        {activeTab === 'ignored' && (
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search ignored messages..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {getCurrentLoading() ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Loader key={i} type="message" />
            ))}
          </div>
        ) : getCurrentError() ? (
          <div className="text-center py-8 text-red-600 dark:text-red-400">{getCurrentError()}</div>
        ) : activeTab === 'ignored' ? (
          <IgnoredMessageList 
            messages={filteredIgnoredMessages} 
            loading={getCurrentLoading()} 
            error={getCurrentError()} 
          />
        ) : (
          <MessageList messages={filteredMessages} currentTab={activeTab} currentTimeFilter={timeFilter} />
        )}
      </div>
    </div>
  );
};
