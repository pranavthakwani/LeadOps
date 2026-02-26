import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getMessageByIdNew, getLeadById, getOfferingById, getIgnoredById } from '../services/api';
import { Button } from '../components/common/Button';
import { ClassificationBadge } from '../components/inbox/ClassificationBadge';
import { OfferingCard } from '../components/common/DetailCard';
import { ChatInterface } from '../components/chat/ChatInterface';
import { Loader } from '../components/common/Loader';
import type { Message } from '../types/message';

export const MessageDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Default 50%
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Store original navigation state when component mounts
  const originalTab = location.state?.tab || 'leads';
  const originalTimeFilter = location.state?.timeFilter || 'today';
  const fromPage = location.state?.from || 'inbox';
  const messageType = location.state?.messageType;

  // Global cache for message data to prevent reloading across navigation
  const globalMessageCache = useRef<Map<string, Message>>(new Map());

  // Listen for cache clear events
  useEffect(() => {
    const handleClearCache = () => {
      globalMessageCache.current.clear();
    };

    window.addEventListener('clearMessageCache', handleClearCache);
    
    return () => {
      window.removeEventListener('clearMessageCache', handleClearCache);
    };
  }, []);

  useEffect(() => {
    const fetchMessage = async () => {
      if (!id) return;

      // Check cache first - no loading state if cached
      const cachedMessage = globalMessageCache.current.get(id);
      if (cachedMessage) {
        setMessage(cachedMessage);
        setLoading(false);
        setIsInitialLoad(false); // Not initial load anymore
        return;
      }

      // Only show loading for non-cached messages or initial load
      if (isInitialLoad) {
        setLoading(true);
      }
      
      let data: Message | null = null;
      
      try {
        // Use separate endpoints based on message type if we have it from navigation state
        if (messageType === 'lead') {
          data = await getLeadById(id);
        } else if (messageType === 'offering') {
          data = await getOfferingById(id);
        } else if (messageType === 'ignored') {
          data = await getIgnoredById(id);
        } else {
          // Fallback: Search all tables when we don't know the type (direct URL/new tab)
          data = await getMessageByIdNew(id);
        }
        
        if (data) {
          setMessage(data);
          // Cache the message
          globalMessageCache.current.set(id, data);
        } else {
          console.error('Failed to fetch message: No data returned');
        }
      } catch (error) {
        console.error('Failed to fetch message', error);
      } finally {
        setLoading(false);
        setIsInitialLoad(false); // Mark initial load as complete
      }
    };

    fetchMessage();
  }, [id, messageType]);

  const handleBack = () => {
    // Navigate back to the original page
    if (fromPage === 'dashboard') {
      // If coming from dashboard, navigate back to dashboard
      navigate('/dashboard');
      return;
    }
    
    const baseUrl = fromPage === 'search' ? '/search' : '/inbox';
    
    // Only add query parameters for inbox navigation
    if (fromPage !== 'search') {
      const params = new URLSearchParams();
      params.set('tab', originalTab);
      params.set('timeFilter', originalTimeFilter);
      
      const finalUrl = `${baseUrl}?${params.toString()}`;
      
      navigate(finalUrl);
    } else {
      // For search page, just navigate back without parameters
      navigate(baseUrl);
    }
  };

  const handleMouseDown = (_e: React.MouseEvent) => {
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Constrain between 20% and 80%
      const constrainedWidth = Math.max(20, Math.min(80, newLeftWidth));
      setLeftPanelWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  useEffect(() => {
    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader />
      </div>
    );
  }

  if (!message) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Message not found</h2>
          <Button onClick={() => navigate('/inbox')}>
            Back to Inbox
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(95vh-20px)] flex flex-col bg-gray-50 dark:bg-black overflow-hidden">
      {/* Main Content - Takes Full Height */}
      <div className="flex flex-1 overflow-hidden" ref={containerRef}>
        {/* Left Panel - Resizable Width */}
        <div 
          className="overflow-y-auto border-r border-gray-200 dark:border-gray-800"
          style={{ width: `${leftPanelWidth}%` }}
        >
          <div className="p-3">
            {/* Top Controls */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              
              <div className="flex items-center gap-3">
                <ClassificationBadge classification={message.classification}/>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(message.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {/* Message Details */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Product Details</h3>
                <OfferingCard message={message} />
              </div>
            </div>
          </div>
        </div>

        {/* Resizable Divider */}
        <div
          className="w-1 bg-gray-300 dark:bg-gray-600 hover:bg-emerald-500 dark:hover:bg-emerald-400 cursor-col-resize transition-colors group"
          onMouseDown={handleMouseDown}
        >
          <div className="h-full w-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-1 h-8 bg-emerald-500 dark:bg-emerald-400 rounded-full"></div>
          </div>
        </div>

        {/* Right Panel - True WhatsApp Layout */}
        <div 
          className="flex flex-col bg-[#efeae2] dark:bg-black"
          style={{ width: `${100 - leftPanelWidth}%` }}
        >
          <ChatInterface message={message} targetMessageId={message.wa_message_id} />
        </div>
      </div>
    </div>
  );
};
