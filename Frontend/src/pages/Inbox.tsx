import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { MessageList } from '../components/inbox/MessageList';
import { MessageFilters } from '../components/inbox/MessageFilters';
import { IgnoredMessageList } from '../components/inbox/IgnoredMessageList';
import { Pagination } from '../components/common/Pagination';
import { Loader } from '../components/common/Loader';
import { useMessages } from '../hooks/useMessages';
import { useOfferings } from '../hooks/useOfferings';
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
  
  // Load page state from localStorage or default to 1
  const [currentPage, setCurrentPage] = useState(() => {
    const savedTab = localStorage.getItem('inbox-active-tab') || 'leads';
    const savedPage = localStorage.getItem(`inbox-page-${savedTab}`);
    return savedPage ? parseInt(savedPage) : 1;
  });
  const debouncedSearch = useDebounce(searchQuery);
  
  const ITEMS_PER_PAGE = 20;

  // Save page state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(`inbox-page-${activeTab}`, currentPage.toString());
  }, [currentPage, activeTab]);

  // Save tab state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('inbox-active-tab', activeTab);
  }, [activeTab]);

  // Load tab state from localStorage on mount
  useEffect(() => {
    const savedTab = localStorage.getItem('inbox-active-tab');
    if (savedTab && ['leads', 'offerings', 'ignored'].includes(savedTab)) {
      setActiveTab(savedTab as TabType);
    }
  }, []);

  // Set active tab and time filter from URL query parameter on component mount
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const timeParam = searchParams.get('timeFilter');
    
    let newTab: TabType = 'leads';
    if (tabParam === 'lead' || tabParam === 'leads') {
      newTab = 'leads';
    } else if (tabParam === 'offering' || tabParam === 'offerings') {
      newTab = 'offerings';
    } else if (tabParam === 'ignored') {
      newTab = 'ignored';
    }

    // Only preserve time filter if coming from message detail (has state)
    // Otherwise, keep current filter (don't reset automatically)
    const isFromMessageDetail = (location.state as any)?.from === '/inbox';
    if (timeParam && ['today', '24h', 'week', 'month', 'all'].includes(timeParam) && isFromMessageDetail) {
      setTimeFilter(timeParam as any);
    }
    // ❌ REMOVE: else if (!isFromMessageDetail) {
    //   setTimeFilter('today'); // This was breaking pagination
    // }
    
    // Only set tab, don't reset page on navigation
    if (newTab !== activeTab) {
      setActiveTab(newTab);
      // ❌ REMOVE: setCurrentPage(1) - don't reset on navigation
    }
  }, [searchParams, location.state]); // ❌ REMOVE: activeTab dependency to prevent loops

  const { messages, loading: messagesLoading, error: messagesError, totalCount: messagesTotalCount } = useMessages(currentPage, ITEMS_PER_PAGE);
  const { messages: offerings, loading: offeringsLoading, error: offeringsError, totalCount: offeringsTotalCount } = useOfferings(currentPage, ITEMS_PER_PAGE);
  const { messages: ignoredMessages, loading: ignoredLoading, error: ignoredError, totalCount: ignoredTotalCount } = useIgnoredMessages(currentPage, ITEMS_PER_PAGE);

  const filteredMessages = useMemo(() => {
    let filtered = activeTab === 'leads' ? messages : 
                   activeTab === 'offerings' ? offerings : [];

    // Filter by classification based on active tab (data is already filtered by endpoint)
    // No need to filter by classification here since each endpoint returns the correct type

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
  }, [messages, offerings, timeFilter, debouncedSearch, activeTab]);

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
    switch (activeTab) {
      case 'leads': return messagesLoading;
      case 'offerings': return offeringsLoading;
      case 'ignored': return ignoredLoading;
      default: return false;
    }
  };

  const getCurrentError = () => {
    switch (activeTab) {
      case 'leads': return messagesError;
      case 'offerings': return offeringsError;
      case 'ignored': return ignoredError;
      default: return null;
    }
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
              onClick={() => {
                setActiveTab(tab);
                setCurrentPage(1); // ✅ only reset page on user tab click
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab
                  ? tab === 'leads' 
                    ? 'bg-white dark:bg-[#151821] text-[var(--accent-primary)] shadow-sm'
                    : tab === 'offerings'
                    ? 'bg-white dark:bg-[#151821] text-blue-500 shadow-sm'
                    : 'bg-white dark:bg-[#151821] text-[var(--text-tertiary)] shadow-sm'
                  : tab === 'leads'
                  ? 'text-gray-500 dark:text-gray-400 hover:text-[var(--accent-primary)] hover:bg-[rgba(0,168,132,0.08)]'
                  : tab === 'offerings'
                  ? 'text-gray-500 dark:text-gray-400 hover:text-blue-500 hover:bg-[rgba(59,130,246,0.08)]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-[var(--text-tertiary)] hover:bg-[rgba(107,114,128,0.08)]'
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

      {/* Messages List - Scrollable container */}
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

      {/* Sticky Pagination */}
      <div className="sticky bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 z-10">
        <div className="max-w-4xl mx-auto">
          {activeTab === 'leads' && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(messagesTotalCount / ITEMS_PER_PAGE)}
              onPageChange={setCurrentPage}
              totalCount={messagesTotalCount}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          )}
          {activeTab === 'offerings' && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(offeringsTotalCount / ITEMS_PER_PAGE)}
              onPageChange={setCurrentPage}
              totalCount={offeringsTotalCount}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          )}
          {activeTab === 'ignored' && (
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(ignoredTotalCount / ITEMS_PER_PAGE)}
              onPageChange={setCurrentPage}
              totalCount={ignoredTotalCount}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          )}
        </div>
      </div>
    </div>
  );
};
