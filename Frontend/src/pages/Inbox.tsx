import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { MessageList } from '../components/inbox/MessageList';
import { MessageFilters } from '../components/inbox/MessageFilters';
import { IgnoredMessageList } from '../components/inbox/IgnoredMessageList';
import { Loader } from '../components/common/Loader';
import { useMessages } from '../hooks/useMessages';
import { useIgnoredMessages } from '../hooks/useIgnoredMessages';
import { useDebounce } from '../hooks/useDebounce';
import { Search } from 'lucide-react';

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
      filtered = filtered.filter((msg) => new Date(msg.timestamp) >= today);
    } else if (timeFilter === '24h') {
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      filtered = filtered.filter((msg) => new Date(msg.timestamp) >= last24h);
    } else if (timeFilter === 'week') {
      const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((msg) => new Date(msg.timestamp) >= lastWeek);
    } else if (timeFilter === 'month') {
      const lastMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      filtered = filtered.filter((msg) => new Date(msg.timestamp) >= lastMonth);
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

  const getAccentColor = () => {
    switch (activeTab) {
      case 'leads': return 'var(--accent-primary)';
      case 'offerings': return '#3b82f6';
      case 'ignored': return 'var(--text-tertiary)';
      default: return 'var(--accent-primary)';
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header Section */}
      <div className="p-8 flex-shrink-0">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2 tracking-tight">
            Inbox
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage your WhatsApp messages
          </p>
        </div>

        {/* Tabs - Refined design with transparency */}
        <div className="flex gap-1 mb-6 p-1 bg-gray-100/70 dark:bg-[#1c1f29]/70 backdrop-blur-sm rounded-2xl inline-flex">
          {(['leads', 'offerings', 'ignored'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab
                  ? 'bg-white dark:bg-[#151821] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
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
          <div className="backdrop-blur-md bg-white/70 dark:bg-[#151821]/70 border border-white/20 dark:border-white/10 rounded-2xl p-4 mb-6 shadow-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search ignored messages..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white/80 dark:bg-[#1c1f29]/80 border border-gray-200/50 dark:border-gray-700/50 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#128c7e] focus:ring-opacity-40 placeholder:text-gray-400 dark:placeholder:text-gray-500 transition-all text-sm backdrop-blur-sm"
              />
            </div>
          </div>
        )}
      </div>

      {/* Messages List */}
      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {/* Accent line indicator */}
        <div className="flex items-center gap-3 mb-4">
          <div 
            className="w-[3px] h-6 rounded-full"
            style={{ backgroundColor: getAccentColor() }}
          />
          <span className="text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider">
            {activeTab === 'leads' && 'New Leads'}
            {activeTab === 'offerings' && 'Product Offerings'}
            {activeTab === 'ignored' && 'Ignored Messages'}
          </span>
        </div>

        {getCurrentLoading() ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Loader key={i} type="message" />
            ))}
          </div>
        ) : getCurrentError() ? (
          <div className="text-center py-8 text-red-500">{getCurrentError()}</div>
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
