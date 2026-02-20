import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, X, User, Reply } from 'lucide-react';
import { formatISTTime, formatISTDate } from '../../utils/timeUtils';
import { sendMessage } from '../../services/api';
import { chatApi } from '../../services/chatApi';
import type { Message } from '../../types/message';
import { ContactModal } from '../common/ContactModal';

interface ChatInterfaceProps {
  message?: Message;
  conversationId?: number;
}

interface DisplayMessage {
  id: number | string;
  text: string;
  timestamp: Date;
  isOutgoing: boolean;
  status: 'pending' | 'sent' | 'delivered' | 'read';
  waMessageId?: string;
  isFromDb?: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ message, conversationId: propConversationId }) => {
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<DisplayMessage[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [conversationId, setConversationId] = useState<number | null>(propConversationId || null);
  const [conversationData, setConversationData] = useState<any>(null);
  const [showSaveContactModal, setShowSaveContactModal] = useState(false);
  const [isSavingContact, setIsSavingContact] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string | number, HTMLDivElement>>(new Map());
  const socketRef = useRef<Socket | null>(null);

  // Load messages from database
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setIsLoading(true);
        
        let convId: number;
        let convData: any;
        
        if (propConversationId) {
          // Direct conversationId provided (from Contacts page)
          convId = propConversationId;
          setConversationId(convId);
          
          // Get conversation info
          const conversations = await chatApi.getConversations();
          const conversation = conversations.find(conv => conv.id === convId);
          
          if (conversation) {
            convData = {
              conversation_id: conversation.id,
              jid: conversation.jid,
              contact_id: conversation.contact_id,
              display_name: conversation.display_name,
              phone_number: conversation.phone_number
            };
            setConversationData(convData);
          }
        } else if (message) {
          // Legacy message-based approach (from MessageDetail page)
          const jid = message.chatId || message.senderNumber.includes('@') 
            ? message.senderNumber 
            : message.senderNumber + '@s.whatsapp.net';
          
          // Get conversations to find the one matching this JID
          const conversations = await chatApi.getConversations();
          const conversation = conversations.find(conv => conv.jid === jid);
          
          if (!conversation) {
            setSendError('Conversation not found');
            return;
          }

          convId = conversation.id;
          setConversationId(convId);
          
          // Create conversationData object for UI consistency
          convData = {
            conversation_id: convId,
            jid: conversation.jid,
            contact_id: conversation.contact_id,
            display_name: conversation.display_name,
            phone_number: conversation.phone_number
          };
          setConversationData(convData);

          // Initialize contact phone from JID if no contact exists
          if (!convData.contact_id && convData.jid) {
            const phone = convData.jid.replace('@s.whatsapp.net', '').replace('@g.us', '').replace('@broadcast', '');
            // Extract phone number without country code for display (if needed for future use)
            const phoneOnly = phone.replace(/^\+/, '');
            console.log('Phone extracted from JID:', phoneOnly);
          }
        } else {
          setSendError('No conversation or message provided');
          return;
        }

        // Load messages using conversation_id
        const dbMessages = await chatApi.getMessagesByConversation(convId);
        
        // Mark conversation as read
        await chatApi.markConversationRead(convId);
        
        // Convert database messages to display format
        const displayMessages: DisplayMessage[] = dbMessages.map((msg: any) => ({
          id: msg.id,
          text: msg.message_text || '',
          timestamp: new Date(Number(msg.message_timestamp)),
          isOutgoing: msg.from_me,
          status: 'sent', // Default status for DB messages
          waMessageId: msg.wa_message_id,
          isFromDb: true
        }));

        // Don't add the original message to chat - just show the existing chat history
        // The original message is already in the database messages
        setChatMessages(displayMessages);

        // Join conversation room for real-time updates
        if (socketRef.current) {
          socketRef.current.emit('join-conversation', convId);
        }

        // Scroll to the clicked message after messages are loaded (only for message-based approach)
        if (message) {
          setTimeout(() => {
            const targetMessage = displayMessages.find(msg => 
              msg.text === (message.rawMessage || '') && 
              Math.abs(msg.timestamp.getTime() - new Date(message.timestamp).getTime()) < 5000
            );
            
            if (targetMessage) {
              const messageElement = messageRefs.current.get(targetMessage.id);
              if (messageElement) {
                messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Highlight the message briefly
                messageElement.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50');
                setTimeout(() => {
                  messageElement.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50');
                }, 2000);
              }
            }
          }, 100);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
        setSendError('Failed to load messages');
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [propConversationId, message]);

  // Socket.IO connection for real-time updates
  useEffect(() => {
    // Connect to Socket.IO backend server, not frontend dev server
    const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5100", { 
      transports: ['websocket'] 
    });
    socketRef.current = socket;

    // Join conversation room when conversationId is available
    if (conversationId) {
      socket.emit('join-conversation', conversationId);
    }

    // Listen for new messages
    socket.on('new-message', (data: any) => {
      setChatMessages(prev => {
        // Check if message already exists (dedupe by waMessageId)
        const exists = prev.some(msg => msg.waMessageId === data.waMessageId);
        if (exists) return prev;

        const newMessage: DisplayMessage = {
          id: data.waMessageId,
          text: data.message_text,
          timestamp: new Date(Number(data.message_timestamp)),
          isOutgoing: data.fromMe,
          status: 'sent',
          waMessageId: data.waMessageId,
          isFromDb: true
        };

        return [...prev, newMessage].sort((a, b) => 
          a.timestamp.getTime() - b.timestamp.getTime()
        );
      });
    });

    socket.on('connect_error', (error: any) => {
      console.warn('Socket.IO connection error:', error);
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO connection closed');
    });

    return () => {
      socket.disconnect();
    };
  }, [conversationId]);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [replyText]);

  const handleSaveContact = async (name: string, jid: string) => {
    if (!conversationId) return;

    try {
      setIsSavingContact(true);
      
      const contactId = await chatApi.saveContactToConversation(
        conversationId,
        name,
        jid
      );

      if (contactId) {
        // Refetch conversation data to get updated contact info
        const conversations = await chatApi.getConversations();
        const updatedConversation = conversations.find(conv => conv.id === conversationId);
        
        if (updatedConversation) {
          const updatedConversationData = {
            conversation_id: updatedConversation.id,
            jid: updatedConversation.jid,
            contact_id: updatedConversation.contact_id,
            display_name: updatedConversation.display_name,
            phone_number: updatedConversation.phone_number
          };
          setConversationData(updatedConversationData);
        }
      }
    } catch (error) {
      console.error('Error saving contact:', error);
      setSendError('Failed to save contact');
    } finally {
      setIsSavingContact(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || isReplying) return;

    const messageText = replyText.trim();
    const tempId = `temp-${Date.now()}`;
    
    // Add message to UI immediately with pending status
    const newMessage: DisplayMessage = {
      id: tempId,
      text: messageText,
      timestamp: new Date(),
      isOutgoing: true,
      status: 'pending'
    };
    
    setChatMessages(prev => [...prev, newMessage]);
    setReplyText('');
    setSendError(null);
    setIsReplying(true);
    
    try {
      const response = await sendMessage({
        jid: conversationData?.jid || 'unknown',
        message: messageText,
        replyToMessageId: message?.id
      });

      if (response.success) {
        // Update message status to sent and store WhatsApp message ID
        setChatMessages(prev => prev.map(msg => 
          msg.id === tempId 
            ? { ...msg, status: 'sent', waMessageId: (response as any).data?.waMessageId }
            : msg
        ));
        
        console.log('Message sent successfully');
      } else {
        // Remove the message and show error
        setChatMessages(prev => prev.filter(msg => msg.id !== tempId));
        setSendError(response.error || 'Failed to send message');
        // Restore the text in input
        setReplyText(messageText);
      }
    } catch (error) {
      // Remove the message and show error
      setChatMessages(prev => prev.filter(msg => msg.id !== tempId));
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

  const canReply = () => {
    // Don't allow reply to own messages
    if (conversationData?.jid?.includes('@broadcast')) return false;
    
    // Allow reply for direct messages and groups
    return true;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header - WhatsApp Style */}
      <div className="bg-[#075e54] dark:bg-[#0b141a] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#128c7e] rounded-full flex items-center justify-center">
            {conversationData?.display_name ? (
              <span className="text-white font-semibold">
                {conversationData.display_name.charAt(0).toUpperCase()}
              </span>
            ) : (
              <User className="w-6 h-6 text-white" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-white">
              {conversationData?.display_name || conversationData?.phone_number || 'Unknown'}
            </h2>
            <p className="text-xs text-[#dcf8c6]">
              {conversationData?.phone_number || conversationData?.jid || 'No number'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Save Contact Button */}
          {conversationData && !conversationData.contact_id && (
            <button
              onClick={() => setShowSaveContactModal(true)}
              className="px-3 py-1.5 bg-[#128c7e] hover:bg-[#0d6efd] text-white text-xs font-medium rounded-lg transition-colors"
            >
              Save Contact
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll Area - WhatsApp Style */}
      <div className="flex-1 overflow-y-auto bg-[#e5ddd5] dark:bg-[#0b141a] px-4 py-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#128c7e] border-t-transparent animate-spin rounded-full"></div>
          </div>
        ) : (
          <>
            {/* Date Separator */}
            {chatMessages.length > 0 && (
              <div className="flex justify-center mb-4">
                <div className="bg-[#e9edef] dark:bg-[#2a3942] px-3 py-1 rounded-full">
                  <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                    {formatISTDate(chatMessages[0].timestamp)}
                  </span>
                </div>
              </div>
            )}

            {/* All Messages (from DB + new ones) */}
            {chatMessages.map((chatMessage) => (
              <div 
                key={chatMessage.id} 
                ref={(el) => {
                  if (el) messageRefs.current.set(chatMessage.id, el);
                }}
                className={`flex ${chatMessage.isOutgoing ? 'justify-end' : 'justify-start'} mb-2`}
              >
                <div className="max-w-[70%]">
                  <div className={`${
                    chatMessage.isOutgoing 
                      ? 'bg-[#dcf8c6] dark:bg-[#005c4b]' 
                      : 'bg-white dark:bg-[#202c33]'
                  } px-4 py-2 rounded-lg ${
                    chatMessage.isOutgoing ? 'rounded-tr-none' : 'rounded-tl-none'
                  } shadow-sm`}>
                    <div className="text-gray-800 dark:text-gray-100 whitespace-pre-wrap break-words text-sm">
                      {chatMessage.text}
                    </div>
                    
                    {/* Message Time and Status */}
                    <div className={`flex ${chatMessage.isOutgoing ? 'justify-end' : 'justify-start'} items-center gap-1 mt-1`}>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatISTTime(chatMessage.timestamp)}
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
          </>
        )}
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
                    Reply to {conversationData?.display_name || conversationData?.phone_number || 'Unknown'}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {conversationData?.phone_number || conversationData?.jid || 'No number'}
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
            {message && (
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
            )}

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
      
      {/* Save Contact Modal */}
      <ContactModal
        isOpen={showSaveContactModal}
        onClose={() => setShowSaveContactModal(false)}
        title="Save Contact"
        submitButtonText="Save Contact"
        onSubmit={handleSaveContact}
        isSubmitting={isSavingContact}
      />
    </div>
  );
};
