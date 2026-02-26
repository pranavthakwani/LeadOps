import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { User, X, Reply, Send, ChevronDown } from 'lucide-react';
import { chatApi } from '../../services/chatApi';
import { SOCKET_BASE_URL } from '../../config/network';
import type { Message } from '../../types/message';
import { ContactModal } from '../common/ContactModal';
import { Loader } from '../common/Loader';

// Helper functions
const formatISTDate = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(date);
};

const formatISTTime = (date: Date) => {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  }).format(date);
};

// WhatsApp-style highlight CSS
const highlightStyles = `
  .message-wrapper {
    position: relative;
    transition: background-color 0.6s ease;
  }
  
  .message-wrapper-highlight {
    animation: highlightFade 3s ease-out forwards;
    border-radius: 8px;
  }
  
  @keyframes highlightFade {
    0% {
      background-color: rgba(37, 211, 102, 0.5);
      box-shadow: 0 0 20px rgba(37, 211, 102, 0.3);
    }
    50% {
      background-color: rgba(37, 211, 102, 0.3);
      box-shadow: 0 0 10px rgba(37, 211, 102, 0.2);
    }
    80% {
      background-color: rgba(37, 211, 102, 0.15);
      box-shadow: 0 0 5px rgba(37, 211, 102, 0.1);
    }
    100% {
      background-color: rgba(37, 211, 102, 0);
      box-shadow: 0 0 0px rgba(37, 211, 102, 0);
    }
  }
  
  .dark .message-wrapper-highlight {
    animation: highlightFade 3s ease-out forwards;
  }
`;

interface ChatInterfaceProps {
  message?: Message;
  conversationId?: number;
  contactId?: number;
  allConversationIds?: number[];
  targetMessageId?: string;
}

interface DisplayMessage {
  id: number | string;
  text: string;
  timestamp: Date;
  isOutgoing: boolean;
  status: 'pending' | 'sent' | 'delivered' | 'read';
  waMessageId?: string;
  isFromDb?: boolean;
  quotedMessageId?: string;
  quotedText?: string;
  quotedFromMe?: boolean;
  quotedSender?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 
  message, 
  conversationId: propConversationId,
  contactId: propContactId,
  allConversationIds,
  targetMessageId
}) => {
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
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [quotedMessage, setQuotedMessage] = useState<{
    id: string;
    text: string;
    sender: string;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string | number, HTMLDivElement>>(new Map());
  const socketRef = useRef<Socket | null>(null);

  // Load messages from database
  useEffect(() => {
    const loadMessages = async () => {
      try {
        setIsLoading(true);
        
        let convId: number | null;
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
            // Create temporary conversation data for non-saved contacts
            console.log('Conversation not found, creating temporary conversation for JID:', jid);
            
            convData = {
              conversation_id: null, // No conversation ID for temporary conversations
              jid: jid,
              contact_id: null,
              display_name: message.sender || 'Unknown Contact',
              phone_number: message.senderNumber || jid.replace('@s.whatsapp.net', '')
            };
            setConversationData(convData);
            
            // Set convId to null for temporary conversations
            convId = null;
          } else {
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
          }

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

        // Load messages using conversation_id or contact_id (for merged messages)
        let dbMessages: any[] = [];
        
        if (propContactId) {
          // Use merged messages from all conversations linked to this contact
          dbMessages = await chatApi.getMergedMessagesByContact(propContactId);
        } else if (convData.contact_id) {
          // Use merged messages from all conversations linked to this contact
          dbMessages = await chatApi.getMergedMessagesByContact(convData.contact_id);
        } else if (convId) {
          // Use single conversation messages
          dbMessages = await chatApi.getMessagesByConversation(convId);
        } else if (convData.jid) {
          // For temporary conversations (non-saved contacts), load messages by JID
          dbMessages = await chatApi.getMessagesByJid(convData.jid);
        } else {
          // No way to load messages
          dbMessages = [];
        }
        
        // Convert database messages to display format
        const displayMessages: DisplayMessage[] = dbMessages.map((msg: any) => ({
          id: msg.id,
          text: msg.message_text || '',
          timestamp: new Date(Number(msg.message_timestamp)),
          isOutgoing: msg.from_me,
          status: 'sent', // Default status for DB messages
          waMessageId: msg.wa_message_id,
          isFromDb: true,
          quotedMessageId: msg.quoted_message_id,
          quotedText: msg.quoted_text,
          quotedFromMe: msg.quoted_from_me
        }));

        // Don't add the original message to chat - just show the existing chat history
        // The original message is already in the database messages
        setChatMessages(displayMessages);

        // Join conversation room for real-time updates
        if (socketRef.current) {
          if (convId) {
            socketRef.current.emit('join-conversation', convId);
          } else if (convData.jid) {
            // For temporary conversations, join by JID
            socketRef.current.emit('join-conversation', convData.jid);
          }
        }

        // Scroll to the target message after messages are loaded (using WhatsApp message ID)
        if (targetMessageId) {
          setTimeout(() => {
            const targetMessage = displayMessages.find(msg => msg.waMessageId === targetMessageId);
            
            if (targetMessage) {
              const messageElement = messageRefs.current.get(targetMessage.id);
              if (messageElement) {
                console.log('Scrolling to target message:', targetMessage.id);
                
                // Remove any existing highlight class first
                messageElement.classList.remove('message-wrapper-highlight');
                
                // Force reflow to restart animation
                void messageElement.offsetWidth;
                
                // Add highlight effect (CSS animation will handle fade out automatically)
                messageElement.classList.add('message-wrapper-highlight');
                
                // Remove the class after animation completes to allow re-triggering
                setTimeout(() => {
                  messageElement.classList.remove('message-wrapper-highlight');
                }, 3000);
                
                // Scroll immediately without animation to avoid showing scroll from top
                messageElement.scrollIntoView({ behavior: 'auto', block: 'center' });
              }
            } else {
              console.log('Target message not found with ID:', targetMessageId);
            }
          }, 100);
        } else {
          // If no target message (opening from contacts), scroll through last 30 messages to latest in 0.5s
          setTimeout(() => {
            const messagesContainer = messagesEndRef.current?.parentElement;
            if (messagesContainer && displayMessages.length > 0) {
              // Start from the position that shows last 30 messages
              const totalMessages = displayMessages.length;
              const messagesToShow = Math.min(30, totalMessages);
              const startIndex = totalMessages - messagesToShow;
              
              // Find the message element to start scrolling from
              const startMessage = displayMessages[startIndex];
              if (startMessage) {
                const startElement = messageRefs.current.get(startMessage.id);
                if (startElement) {
                  // Start at the position showing last 30 messages
                  startElement.scrollIntoView({ behavior: 'auto', block: 'start' });
                  
                  // Then smooth scroll to the latest message
                  setTimeout(() => {
                    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                  }, 50);
                }
              } else {
                // Fallback: scroll to bottom smoothly
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
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
  }, [propConversationId, message, targetMessageId]);

  // Socket.IO connection for real-time updates
  useEffect(() => {
    const socket = io(SOCKET_BASE_URL, {
      transports: ['websocket'],
      upgrade: false
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket.IO connected');
      
      // Join conversation room after socket is connected
      if (conversationId) {
        console.log('Joining conversation room:', conversationId);
        socket.emit('join-conversation', conversationId);
      }

      // For merged contacts, join all conversation rooms
      if (propContactId && allConversationIds && allConversationIds.length > 0) {
        console.log('Joining merged conversation rooms:', allConversationIds);
        allConversationIds.forEach(convId => {
          console.log('Joining room:', convId);
          socket.emit('join-conversation', convId);
        });
      }
    });

    // Listen for new messages
    socket.on('new-message', (data: any) => {
      console.log('🔥 New message received in chat:', data);
      console.log('Current chat messages count:', chatMessages.length);
      
      setChatMessages(prev => {
        // Check if message already exists (dedupe by waMessageId)
        const exists = prev.some(msg => msg.waMessageId === data.waMessageId);
        if (exists) {
          console.log('Message already exists, skipping');
          return prev;
        }

        console.log('Adding new message to chat');
        const newMessage: DisplayMessage = {
          id: data.waMessageId,
          text: data.message_text,
          timestamp: new Date(Number(data.message_timestamp)),
          isOutgoing: data.fromMe,
          status: 'sent',
          waMessageId: data.waMessageId,
          isFromDb: true,
          quotedMessageId: data.quoted_message_id,
          quotedText: data.quoted_text,
          quotedFromMe: data.quoted_from_me
        };

        const updatedMessages = [...prev, newMessage].sort((a, b) => 
          a.timestamp.getTime() - b.timestamp.getTime()
        );
        console.log('Updated messages count:', updatedMessages.length);
        
        return updatedMessages;
      });
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO connection closed');
    });

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up socket connection');
      socket.disconnect();
    };
  }, [conversationId, propContactId, allConversationIds]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Scroll detection for showing scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 100; // 100px threshold
      setShowScrollToBottom(!isAtBottom);
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => container.removeEventListener('scroll', handleScroll);
  }, [chatMessages]); // Re-attach when messages change

  // Scroll to bottom function
  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      setShowScrollToBottom(false);
    }
  };

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

  const handleSaveContactClick = () => {
    setShowSaveContactModal(true);
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || isReplying) return;

    setIsReplying(true);
    setSendError(null);

    const messageText = replyText.trim();
    setReplyText(''); // Clear input immediately
    
    // Clear quoted message after sending
    setQuotedMessage(null);
    
    try {
      let response;
      
      if (conversationId) {
        // Use conversation-based API for saved contacts
        response = await chatApi.sendMessage(
          conversationId,
          messageText,
          quotedMessage?.id
        );
      } else if (conversationData?.jid) {
        // Use JID-based API for temporary conversations (non-saved contacts)
        response = await chatApi.sendMessageByJid(
          conversationData.jid,
          messageText,
          quotedMessage?.id
        );
      } else {
        throw new Error('No conversation ID or JID available for sending message');
      }
      
      console.log('Sent message with quote:', { 
        conversationId: conversationId || 'temp',
        targetJid: conversationData?.jid, 
        messageText, 
        replyToMessageId: quotedMessage?.id,
        quotedMessage 
      });

      if (response) {
        console.log('Message sent successfully');
        // Let socket handle the message addition - no optimistic UI
      } else {
        setSendError('Failed to send message');
        // Restore quoted message on error
        if (quotedMessage) {
          setQuotedMessage(quotedMessage);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setSendError('Failed to send message');
      // Restore quoted message on error
      if (quotedMessage) {
        setQuotedMessage(quotedMessage);
      }
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

  const handleQuoteMessage = (message: DisplayMessage) => {
    const quoteId = message.waMessageId || String(message.id);
    console.log('Quoting message:', { 
      messageText: message.text, 
      waMessageId: message.waMessageId, 
      id: message.id, 
      finalQuoteId: quoteId 
    });
    
    // Determine the sender name properly
    let senderName: string;
    if (message.isOutgoing) {
      senderName = 'You';
    } else {
      // For incoming messages, try to get the contact name
      senderName = conversationData?.display_name || 
                   conversationData?.phone_number || 
                   conversationData?.jid?.replace('@s.whatsapp.net', '')?.replace('@g.us', '')?.replace('@broadcast', '') ||
                   'Contact';
    }
    
    setQuotedMessage({
      id: quoteId,
      text: message.text,
      sender: senderName
    });
    // Focus the textarea
    textareaRef.current?.focus();
  };

  const handleRemoveQuote = () => {
    setQuotedMessage(null);
  };

  const canReply = () => {
    // Don't allow reply to broadcast messages unless they have been linked to a contact
    if (conversationData?.jid?.includes('@broadcast') && !conversationData?.contact_id) return false;
    
    // Allow reply for direct messages, groups, and contacts that have been linked
    return true;
  };

  const handleScrollToQuotedMessage = (chatMessage: DisplayMessage) => {
    console.log('Scrolling to quoted message:', { 
      quotedMessageId: chatMessage.quotedMessageId,
      currentMessageId: chatMessage.id,
      waMessageId: chatMessage.waMessageId 
    });
    
    // Find the original message being quoted
    const originalMessage = chatMessages.find(msg => 
      msg.waMessageId === chatMessage.quotedMessageId || 
      msg.id === chatMessage.quotedMessageId
    );
    
    console.log('Found original message:', originalMessage ? 'YES' : 'NO');
    
    if (originalMessage) {
      const messageElement = messageRefs.current.get(originalMessage.id);
      if (messageElement) {
        console.log('Scrolling to message element:', originalMessage.id);
        
        // Scroll to the message
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Remove any existing highlight class first
        messageElement.classList.remove('message-wrapper-highlight');
        
        // Force reflow to restart animation
        void messageElement.offsetWidth;
        
        // Add highlight effect (CSS animation will handle fade out automatically)
        messageElement.classList.add('message-wrapper-highlight');
        
        // Remove the class after animation completes to allow re-triggering
        setTimeout(() => {
          messageElement.classList.remove('message-wrapper-highlight');
        }, 3000);
      } else {
        console.log('Message element not found in refs');
      }
    } else {
      console.log('Original message not found in chatMessages');
    }
  };

  return (
    <>
      {/* Inject WhatsApp-style highlight CSS */}
      <style>{highlightStyles}</style>
      
      <div className="flex flex-col h-full bg-[#efeae2] dark:bg-[#0b141a]">
        {/* Chat Header - Frosted translucent with rounded corners */}
        <div className="sticky top-0 z-20 mx-4 mt-3 mb-2">
          <div className="backdrop-blur-xl bg-[#075e54]/85 dark:bg-[#0b141a]/85 px-4 py-3 flex items-center justify-between rounded-2xl shadow-lg shadow-black/20 border border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#128c7e] rounded-full flex items-center justify-center shadow-md">
                {conversationData?.display_name ? (
                  <span className="text-white font-semibold text-sm">
                    {conversationData.display_name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="w-6 h-6 text-white" />
                )}
              </div>
              <div>
                <h2 className="font-semibold text-white drop-shadow-sm">
                  {conversationData?.display_name || conversationData?.phone_number || 'Unknown'}
                </h2>
                <p className="text-xs text-[#dcf8c6]/90">
                  {conversationData?.phone_number || conversationData?.jid || 'No number'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Save Contact Button */}
              {conversationData && !conversationData.contact_id && (
                <button
                  onClick={handleSaveContactClick}
                  disabled={isSavingContact}
                  className="bg-[#128c7e] hover:bg-[#0d6d5f] text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50 shadow-md"
                >
                  {isSavingContact ? 'Saving...' : 'Save Contact'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {sendError && (
          <div className="mx-4 mb-2">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">!</span>
                  </div>
                  <span className="text-red-700 dark:text-red-300 text-sm">{sendError}</span>
                </div>
                <button
                  onClick={() => setSendError(null)}
                  className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages Area - WhatsApp Style */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1" ref={messagesContainerRef}>
          {isLoading ? (
            <div className="flex-1 h-full">
              <Loader type="chat" />
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-gray-500 dark:text-gray-400 text-center">
                <div className="mb-2">No messages yet</div>
                <div className="text-sm">Start the conversation!</div>
              </div>
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

              {/* All Messages */}
              {chatMessages.map((chatMessage, index) => {
                const previousMessage = chatMessages[index - 1];
                const isGrouped = previousMessage && previousMessage.isOutgoing === chatMessage.isOutgoing;
                
                return (
                  <div 
                    key={chatMessage.id} 
                    ref={(el) => {
                      if (el) messageRefs.current.set(chatMessage.id, el);
                    }}
                    className={`flex ${chatMessage.isOutgoing ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-1'} group`}
                  >
                    <div className={`relative max-w-[65%] px-2 py-1.5 rounded-lg text-sm hover:shadow-md transition-shadow duration-200 ${
                      chatMessage.isOutgoing 
                        ? 'bg-[#d9fdd3] text-black dark:bg-[#005c4b] dark:text-white' 
                        : 'bg-white text-black dark:bg-[#202c33] dark:text-white'
                    } ${
                      chatMessage.isOutgoing 
                        ? (isGrouped ? 'rounded-tr-lg' : 'rounded-tr-none')
                        : (isGrouped ? 'rounded-tl-lg' : 'rounded-tl-none')
                    }`}>
                      {/* Quoted Message - INSIDE bubble */}
                      {chatMessage.quotedText && (
                        <div className={`mb-1 px-2 py-1 rounded-md text-xs border-l-4 ${
                          chatMessage.isOutgoing 
                            ? 'bg-[#cfe9ba] border-green-600 dark:bg-[#004d3a] dark:border-green-500'
                            : 'bg-[#f0f2f5] border-[#00a884] dark:bg-[#2a3942] dark:border-[#00a884]'
                        }`}>
                          <div className="font-semibold text-[11px] text-[#00a884] dark:text-[#00a884]">
                            {chatMessage.quotedFromMe ? 'You' : (conversationData?.display_name || 'Contact')}
                          </div>
                          <div 
                            className="truncate text-[12px] opacity-80 cursor-pointer hover:opacity-100"
                            onClick={() => handleScrollToQuotedMessage(chatMessage)}
                          >
                            {chatMessage.quotedText}
                          </div>
                        </div>
                      )}
                      

                      {/* Message Text */}
                      <div className="break-words whitespace-pre-wrap">
                        {chatMessage.text}
                      </div>
                      

                      {/* Timestamp - INSIDE bubble */}
                      <div className="flex justify-end items-end gap-1 mt-1">
                        <span className="text-[10px] opacity-60 dark:opacity-70">
                          {formatISTTime(chatMessage.timestamp)}
                        </span>
                        {chatMessage.isOutgoing && (
                          <svg viewBox="0 0 24 24" className="w-3 h-3 opacity-60 dark:opacity-70" fill="currentColor">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                          </svg>
                        )}
                      </div>
                      
                      {/* Quote Button - Show on hover */}
                      <button
                        onClick={() => handleQuoteMessage(chatMessage)}
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                        title="Reply to message"
                      >
                        <Reply className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        
        {/* Scroll to Bottom Button */}
        {showScrollToBottom && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-[-15px] right-8 bg-[#ffffff] dark:bg-[#2a3942] shadow-lg rounded-full p-3 hover:bg-gray-100 dark:hover:bg-[#3b4a54] transition-all duration-200 z-10"
            style={{ marginBottom: '100px' }}
          >
            <ChevronDown className="w-5 h-5 text-[#8696a0] dark:text-[#8696a0]" />
          </button>
        )}

        {/* Input Area - WhatsApp Style */}
        {canReply() && (
          <div className="bg-white dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#2a3942]">
            {/* Quoted Message Preview */}
            {quotedMessage && (
              <div className="bg-white dark:bg-[#202c33] px-4 py-2 border-l-4 border-[#00a884] flex justify-between items-start">
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[#00a884] mb-1">
                    Replying to {quotedMessage.sender}
                    <button
                      onClick={handleRemoveQuote}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 ml-2"
                    >
                      ×
                    </button>
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 truncate">
                    {quotedMessage.text.length > 50 ? `${quotedMessage.text.substring(0, 50)}...` : quotedMessage.text}
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-2 px-4 py-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type a message..."
                ref={textareaRef}
                className="flex-1 bg-[#f0f2f5] dark:bg-[#2a3942] rounded-full px-4 py-2 text-sm resize-none outline-none focus:outline-none focus:ring-1 focus:ring-[#00a884] dark:text-white"
                rows={1}
                style={{ minHeight: '36px', maxHeight: '120px' }}
              />
              
              <button
                onClick={handleSendReply}
                disabled={!replyText.trim() || isReplying}
                className="bg-[#00a884] hover:bg-[#008069] disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-full p-2 transition-colors disabled:cursor-not-allowed"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
                </svg>
              </button>
            </div>
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
          conversationId={conversationId || undefined}
        />
      </div>
    </>
  );
};
