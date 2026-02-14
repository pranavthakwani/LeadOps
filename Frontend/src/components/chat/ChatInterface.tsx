import React, { useState, useEffect, useRef } from 'react';
import { Send, Reply, X } from 'lucide-react';
import { sendMessage } from '../../services/api';
import type { Message } from '../../types/message';

interface ChatInterfaceProps {
  message: Message;
}

interface SentMessage {
  id: string;
  text: string;
  timestamp: Date;
  isOutgoing: true;
  status: 'pending' | 'sent' | 'delivered' | 'read';
  waMessageId?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ message }) => {
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [sentMessages, setSentMessages] = useState<SentMessage[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    // Connect to WebSocket for read receipt updates
    const ws = new WebSocket('ws://localhost:3001');
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'message-status-update') {
        // Update message status based on read receipt
        setSentMessages(prev => prev.map(msg => 
          msg.waMessageId === data.messageId 
            ? { ...msg, status: data.status }
            : msg
        ));
      }
    };

    ws.onerror = (error) => {
      console.warn('WebSocket connection error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket connection closed');
    };

    return () => {
      ws.close();
    };
  }, []);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sentMessages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [replyText]);

  const handleSendReply = async () => {
    if (!replyText.trim() || isReplying) return;

    const messageText = replyText.trim();
    const tempId = `temp-${Date.now()}`;
    
    // Add message to UI immediately with pending status
    const newMessage: SentMessage = {
      id: tempId,
      text: messageText,
      timestamp: new Date(),
      isOutgoing: true,
      status: 'pending'
    };
    
    setSentMessages(prev => [...prev, newMessage]);
    setReplyText('');
    setSendError(null);
    setIsReplying(true);
    
    try {
      const response = await sendMessage({
        jid: message.senderNumber,
        message: messageText,
        replyToMessageId: message.id
      });

      if (response.success) {
        // Update message status to sent and store WhatsApp message ID
        setSentMessages(prev => prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, status: 'sent', waMessageId: (response as any).data?.waMessageId }
            : msg
        ));
        
        // In real implementation, status updates come from WebSocket
        // For now, we'll keep it as 'sent' until real read receipts arrive
        console.log('Message sent successfully');
      } else {
        // Remove the message and show error
        setSentMessages(prev => prev.filter(msg => msg.id !== tempId));
        setSendError(response.error || 'Failed to send message');
        // Restore the text in input
        setReplyText(messageText);
      }
    } catch (error) {
      // Remove the message and show error
      setSentMessages(prev => prev.filter(msg => msg.id !== tempId));
      setSendError('Error sending message. Please try again.');
      // Restore the text in input
      setReplyText(messageText);
    } finally {
      setIsReplying(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  // WhatsApp-style tick components
  const SingleTick = ({ color = "#8696a0" }) => (
    <svg width="16" height="11" viewBox="0 0 16 11">
      <path
        d="M1 5.5L5.5 10L15 1"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const DoubleTick = ({ color = "#8696a0" }) => (
    <svg width="18" height="11" viewBox="0 0 18 11">
      <path
        d="M1 5.5L5.5 10L15 1"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 5.5L8.5 10L18 1"
        stroke={color}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const getStatusIcon = (status: SentMessage['status']) => {
    switch (status) {
      case 'pending':
        return <SingleTick />;
      case 'sent':
        return <SingleTick />;
      case 'delivered':
        return <DoubleTick />;
      case 'read':
        return <DoubleTick color="#53bdeb" />;
      default:
        return <SingleTick />;
    }
  };

  
  const canReply = () => {
    // Don't allow reply to own messages
    if (message.fromMe) return false;
    
    // Don't allow reply to broadcast messages
    if (message.senderNumber?.includes('@broadcast')) return false;
    
    // Don't allow reply to group messages
    if (message.senderNumber?.includes('@g.us')) return false;
    
    // Allow LID but show warning
    return true;
  };

  const isLid = message.senderNumber?.includes('@lid');

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header - WhatsApp Style */}
      <div className="h-14 px-4 flex items-center bg-[#f0f2f5] dark:bg-[#202c33] border-b border-[#e9edef] dark:border-[#2a3942]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#128c7e] dark:bg-[#005c4b]   rounded-full flex items-center justify-center">
            <span className="text-white font-semibold text-lg">
              {message.sender?.charAt(0)?.toUpperCase() || 'U'}
            </span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
              {message.sender}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {message.senderNumber}
              {isLid && (
                <span className="ml-2 px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-400 rounded-full text-xs font-medium">
                  Unstable (LID)
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Scroll Area - WhatsApp Style */}
      <div className="flex-1 overflow-y-auto bg-[#e5ddd5] dark:bg-[#0b141a] px-4 py-4">
        {/* Date Separator */}
        <div className="flex justify-center mb-4">
          <div className="bg-[#e9edef] dark:bg-[#2a3942] px-3 py-1 rounded-full">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
              {new Date(message.timestamp).toLocaleDateString('en-US', { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric' 
              })}
            </span>
          </div>
        </div>

        {/* Original Message */}
        <div className="flex justify-start mb-2">
          <div className="max-w-[70%]">
            <div className="bg-white dark:bg-[#202c33] px-4 py-2 rounded-lg rounded-tl-none shadow-sm">
              <div className="text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words text-sm">
                {message.rawMessage}
              </div>
              
              {/* Message Metadata */}
              {message.parsedData && (
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                  <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    {message.parsedData.brand && (
                      <div><strong>Brand:</strong> {message.parsedData.brand}</div>
                    )}
                    {message.parsedData.model && (
                      <div><strong>Model:</strong> {message.parsedData.model}</div>
                    )}
                    {message.parsedData.price && (
                      <div><strong>Price:</strong> ₹{message.parsedData.price.toLocaleString('en-IN')}/-</div>
                    )}
                    {message.parsedData.quantity && (
                      <div><strong>Quantity:</strong> {message.parsedData.quantity} units</div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Message Time */}
              <div className="flex justify-end mt-1">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(message.timestamp).toLocaleTimeString('en-US', { 
                    hour: 'numeric', 
                    minute: '2-digit',
                    hour12: true 
                  }).toLowerCase()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Sent Messages */}
        {sentMessages.map((sentMessage) => (
          <div key={sentMessage.id} className="flex justify-end mb-2">
            <div className="max-w-[70%]">
              <div className="bg-[#dcf8c6] dark:bg-[#005c4b] px-4 py-2 rounded-lg rounded-tr-none shadow-sm">
                <div className="text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words text-sm">
                  {sentMessage.text}
                </div>
                
                {/* Message Time and Status */}
                <div className="flex justify-end items-center gap-1 mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {sentMessage.timestamp.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    }).toLowerCase()}
                  </span>
                  <span className="flex items-center">
                    {getStatusIcon(sentMessage.status)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Error Message */}
        {sendError && (
          <div className="flex justify-center mb-2">
            <div className="bg-red-100 dark:bg-red-900/50 px-3 py-2 rounded-lg max-w-[90%]">
              <p className="text-xs text-red-700 dark:text-red-400 text-center">
                {sendError}
              </p>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - WhatsApp Style */}
      {canReply() && (
        <div className="h-16 bg-[#f0f2f5] dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#2a3942] flex items-center px-3 gap-2">
          <div className="flex-1 flex items-center bg-white dark:bg-[#2a3942] rounded-full px-4 py-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type a message"
              className="flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100 text-sm placeholder-gray-500 dark:placeholder-gray-400"
              disabled={isReplying}
              maxLength={500}
            />
          </div>
          <button
            onClick={handleSendReply}
            disabled={!replyText.trim() || isReplying}
            className="bg-[#128c7e] hover:bg-[#005c4b] disabled:bg-gray-400 disabled:cursor-not-allowed text-white p-2 rounded-full transition-colors"
          >
            {isReplying ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
            ) : (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"></path>
              </svg>
            )}
          </button>
        </div>
      )}

      {/* Reply Modal for longer messages */}
      {showReplyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-[#202c33] rounded-lg max-w-lg w-full max-h-96 flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Reply className="w-5 h-5 text-[#128c7e]" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                    Reply to {message.sender}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {message.senderNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReplyModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>

            {/* Original Message Preview */}
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Replying to:
              </p>
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                <p className="text-sm text-gray-800 dark:text-gray-200">
                  {message.rawMessage}
                </p>
              </div>
            </div>

            {/* Reply Input */}
            <div className="flex-1 p-4">
              <textarea
                ref={textareaRef}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type your reply..."
                className="w-full h-24 p-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-[#128c7e] focus:border-[#128c7e] dark:bg-gray-800 dark:text-white"
                disabled={isReplying}
              />
              
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {replyText.length}/500 characters
                </span>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowReplyModal(false)}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  
                  <button
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || isReplying}
                    className="px-4 py-2 bg-[#128c7e] hover:bg-[#005c4b] disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    {isReplying ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        <span>Send</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
