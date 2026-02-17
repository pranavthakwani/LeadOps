import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getMessageByIdNew } from '../services/api';
import { Button } from '../components/common/Button';
import { ClassificationBadge } from '../components/inbox/ClassificationBadge';
import { OfferingCard } from '../components/common/DetailCard';
import { IgnoredMessageCard } from '../components/common/IgnoredMessageCard';
import { ChatInterface } from '../components/chat/ChatInterface';
import { Loader } from '../components/common/Loader';
import type { Message } from '../types/message';

export const MessageDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [message, setMessage] = useState<Message | null>(null);
  const [loading, setLoading] = useState(true);
  const [leftPanelWidth, setLeftPanelWidth] = useState(50); // Default 50%
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessage = async () => {
      if (!id) return;

      try {
        const data = await getMessageByIdNew(id);
        setMessage(data);
      } catch (error) {
        console.error('Failed to fetch message', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMessage();
  }, [id]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
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
                onClick={() => navigate(-1)}
                className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              
              <div className="flex items-center gap-3">
                <ClassificationBadge classification={message.classification} />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {new Date(message.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              {/* Message Details - Based on Classification */}
              {message.classification === 'ignored' ? (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Message Details</h3>
                  <IgnoredMessageCard message={message} />
                </div>
              ) : (
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Product Details</h3>
                  <OfferingCard message={message} />
                </div>
              )}
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
          <ChatInterface message={message} />
        </div>
      </div>
    </div>
  );
};
