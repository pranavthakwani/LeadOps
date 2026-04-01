import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { X, Reply, Send, ChevronDown, MoreVertical, Trash2, AlertCircle, Volume2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { chatApi } from '../../services/chatApi';
import { SOCKET_BASE_URL } from '../../config/network';
import { Message } from '../../types/message';
import { Contact as ApiContact } from '../../services/chatApi';
import { UnifiedContactModal } from '../common/UnifiedContactModal';
import { ProfilePicPreviewModal } from '../common/ProfilePicPreviewModal';
import { Loader } from '../common/Loader';
import { formatPhoneNumberDisplay } from '../../utils/phoneUtils';
import { getFirstLetterForAvatar } from '../../utils/avatarUtils';
import { getColorFromString } from '../../utils/colorUtils';

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

// Helper function to get day start (midnight) for comparison
const getDayStart = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper function to check if day separator is needed
const needsDaySeparator = (currentMessage: any, previousMessage: any) => {
  if (!previousMessage) return true; // First message always needs separator
  
  const currentDay = getDayStart(new Date(currentMessage.timestamp));
  const previousDay = getDayStart(new Date(previousMessage.timestamp));
  
  return currentDay.getTime() !== previousDay.getTime();
};

// Helper function to format day separator text (WhatsApp style)
const formatDaySeparator = (date: Date) => {
  const now = new Date();
  const messageDate = new Date(date);
  const today = getDayStart(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const messageDay = getDayStart(messageDate);
  
  if (messageDay.getTime() === today.getTime()) {
    return 'Today';
  } else if (messageDay.getTime() === yesterday.getTime()) {
    return 'Yesterday';
  } else {
    // Check if within this week
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    if (messageDay.getTime() > weekAgo.getTime()) {
      return messageDate.toLocaleDateString('en-US', { weekday: 'long' });
    } else {
      return formatISTDate(messageDate);
    }
  }
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
  onContactUpdate?: (data: any) => void;
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
  // Group message fields
  pushName?: string;
  senderJid?: string;
  isGroupMessage?: boolean;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  message,
  conversationId: propConversationId,
  contactId: propContactId,
  allConversationIds,
  targetMessageId,
  onContactUpdate
}) => {
  const navigate = useNavigate();
  const [replyText, setReplyText] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<DisplayMessage[]>([]);
  const [sendError, setSendError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [conversationId, setConversationId] = useState<number | null>(propConversationId || null);
  const [conversationData, setConversationData] = useState<any>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [quotedMessage, setQuotedMessage] = useState<{
    id: string;
    text: string;
    sender: string;
  } | null>(null);
  const [profilePreview, setProfilePreview] = useState<{ url: string; name: string } | null>(null);
  const [unifiedModalOpen, setUnifiedModalOpen] = useState(false);
  const [unifiedModalMode, setUnifiedModalMode] = useState<'save' | 'edit' | 'merge'>('save');
  const [showContactMenu, setShowContactMenu] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [mergedConversations, setMergedConversations] = useState<any[]>([]);
  const [unmergeLoading, setUnmergeLoading] = useState(false);
  const [mergedConversationCount, setMergedConversationCount] = useState(0);
  const [contacts, setContacts] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string | number, HTMLDivElement>>(new Map());
  const socketRef = useRef<Socket | null>(null);

  // Helper function to format display name with proper styling for pushName vs saved name
  const formatDisplayName = (conversationData: any) => {
    // For group conversations, prioritize group_name over other fields
    const displayName = conversationData?.type === 'group' 
      ? (conversationData?.group_name || conversationData?.display_name || conversationData?.jid || 'Unknown Group')
      : (conversationData?.display_name || 
         conversationData?.phone_number || 
         conversationData?.jid || 
         conversationData?.lid ||
         'Unknown'); // Only show "Unknown" if absolutely nothing exists
    
    // Return object with display info for styling
    return {
      text: displayName,
      isPushName: conversationData?.is_auto_generated && 
                  displayName !== conversationData?.phone_number && 
                  displayName !== conversationData?.jid,
      showTilde: conversationData?.is_auto_generated && 
                displayName !== conversationData?.phone_number && 
                displayName !== conversationData?.jid
    };
  };

  // Helper function to get group participants from messages
  const getGroupParticipants = () => {
    if (!chatMessages || chatMessages.length === 0) return [];

    const unique = new Map();

    chatMessages.forEach(msg => {
      if (!msg.isOutgoing) {
        const jid = msg.senderJid || '';
        const rawName = msg.pushName || jid.replace(/@s\.whatsapp\.net|@lid|@g\.us|@broadcast/g, '');
        
        // Add "~" prefix for push names (auto-generated names)
        const displayName = msg.pushName && msg.pushName !== jid.replace(/@s\.whatsapp\.net|@lid|@g\.us|@broadcast/g, '') 
          ? `~${rawName}` 
          : rawName;

        if (jid && !unique.has(jid)) {
          unique.set(jid, displayName);
        }
      }
    });

    const participants = Array.from(unique.values());
    
    // Always add "You" at the end for group chats since user is part of every group they can see
    participants.push('You');

    return participants;
  };

  // Load messages from database
  const loadMessages = async () => {
    try {
      setIsLoading(true);
      
      // Load contacts for sender name resolution
      const contactsList = await chatApi.getContacts();
      setContacts(contactsList);
      
      let convId: number | null;
      let convData: any;
      
      if (propConversationId) {
        // Direct conversationId provided (from Contacts page)
        convId = propConversationId;
        setConversationId(convId);
        
        // Get conversation info
        const conversations = await chatApi.getConversations();
        const conversation = conversations.find(conv => conv.conversation_id === convId);
        
        if (conversation && conversation.primary_jid) {
          // For @g.us conversations, get the conversation directly
          if (conversation.primary_jid.endsWith('@g.us')) {
            // Groups don't have contacts, use conversation data directly
            convData = {
              conversation_id: conversation.conversation_id,
              jid: conversation.primary_jid,
              contact_id: null, // Groups don't have contact_id
              display_name: conversation.display_name || conversation.primary_jid,
              phone_number: null, // Groups don't have phone numbers
              profile_pic_url: conversation.profile_pic_url,
              is_auto_generated: false,
              type: conversation.type || 'group' // Include type for groups
            };
          } else {
            // Direct conversation
            convData = {
              conversation_id: conversation.conversation_id,
              jid: conversation.primary_jid,
              contact_id: conversation.id,
              display_name: conversation.display_name || conversation.primary_jid,
              phone_number: conversation.phone_number,
              profile_pic_url: conversation.profile_pic_url,
              is_auto_generated: conversation.is_auto_generated,
              type: conversation.type || 'direct' // Include type for direct
            };
          }
          setConversationData(convData);
          
          // Check if this conversation has been merged (has conversation_id but we're accessing by conversation_id)
          if (conversation.conversation_id && !propContactId) {
            // This conversation is merged, we should show merged messages
            console.log('Detected merged conversation, loading merged messages', {
              conversationId: conversation.id,
              contactId: conversation.conversation_id
            });
            // The message loading logic below will handle this via convData.contact_id
          }
        } else {
          // Conversation not found, create fallback convData
          console.warn('Conversation not found for ID:', convId, 'creating fallback data');
          convData = {
            conversation_id: convId,
            jid: null,
            contact_id: null,
            display_name: 'Unknown Conversation',
            phone_number: null,
            type: 'direct'
          };
          setConversationData(convData);
        }
      } else if (message) {
        // Legacy message-based approach (from MessageDetail page)
        // Use message.chatId directly as it contains the full JID
        const jid = message.chatId || message.senderNumber.includes('@') 
          ? message.senderNumber 
          : message.senderNumber + '@s.whatsapp.net';
        
        console.log('🔍 Looking up conversation by JID:', { jid, messageChatId: message.chatId, senderNumber: message.senderNumber });
        
        // For broadcast messages, we need to find the conversation by participant JID, not broadcast JID
        let lookupJid = jid;
        if (jid.includes('@broadcast')) {
          // For broadcast messages, use the sender_jid field to find the participant conversation
          console.log('📡 Broadcast message detected, finding participant conversation...');
          
          // Use sender_jid from message if available (this is the participant JID)
          if (message.sender_jid && !message.sender_jid.includes('@broadcast')) {
            lookupJid = message.sender_jid;
            console.log('✅ Using sender_jid for broadcast participant:', lookupJid);
          } else {
            // Fallback: use sender field if it doesn't contain broadcast
            const senderJid = message.sender || message.senderNumber;
            if (senderJid && !senderJid.includes('@broadcast')) {
              lookupJid = senderJid;
              console.log('✅ Using sender field for broadcast participant:', lookupJid);
            } else {
              // Final fallback: look for the most recent non-broadcast conversation
              const conversations = await chatApi.getConversations();
              const participantConversation = conversations.find(conv => {
                return conv.primary_jid && !conv.primary_jid.includes('@broadcast') && !conv.primary_jid.includes('@g.us');
              });
              
              if (participantConversation) {
                lookupJid = participantConversation.primary_jid;
                console.log('✅ Found participant conversation for broadcast (fallback):', lookupJid);
              } else {
                console.log('❌ No participant conversation found for broadcast, using original JID');
              }
            }
          }
        }
        
        // Get conversations to find the one matching this JID
        const conversations = await chatApi.getConversations();
        const conversation = conversations.find(conv => conv.primary_jid === lookupJid);
        
        if (conversation) {
          console.log('✅ Found conversation:', { id: conversation.id, conversation_id: conversation.conversation_id, jid: conversation.primary_jid });
          convId = conversation.conversation_id || conversation.id;
          setConversationId(convId);
          
          // Set convData with correct conversation info
          convData = {
            conversation_id: convId,
            jid: conversation.primary_jid,
            contact_id: conversation.id,
            display_name: conversation.display_name || conversation.primary_jid,
            phone_number: conversation.phone_number,
            profile_pic_url: conversation.profile_pic_url,
            is_auto_generated: conversation.is_auto_generated,
            type: conversation.primary_jid.endsWith('@g.us') ? 'group' : 'direct'
          };
          setConversationData(convData);
        } else {
          // Create temporary conversation data for non-saved contacts
          console.log('Conversation not found, creating temporary conversation for JID:', jid);
          
          convData = {
            conversation_id: null, // No conversation ID for temporary conversations
            jid: jid,
            contact_id: null,
            display_name: message.sender || 'Unknown Contact',
            phone_number: message.senderNumber || jid.replace(/@s\.whatsapp\.net|@lid|@g\.us|@broadcast/g, '')
          };
          setConversationData(convData);
          
          // Set convId to null for temporary conversations
          convId = null;
        }

        // Initialize contact phone from JID if no contact exists
        if (convData && !convData.contact_id && convData.jid) {
          const phone = convData.jid.replace(/@s\.whatsapp\.net|@lid|@g\.us|@broadcast/g, '');
          // Extract phone number without country code for display (if needed for future use)
          const phoneOnly = phone.replace(/^\+/, '');
          console.log('Phone extracted from JID:', phoneOnly);
        }
      } else {
        setSendError('No conversation or message provided');
        return;
      }

      // Load messages with correct priority: group first, then contact, then conversation
      let dbMessages: any[] = [];
      
      // Debug logging
      console.log("Loading messages with:", {
        conversationId: convId,
        contactId: convData?.contact_id,
        type: convData?.type,
        propContactId
      });
      
      if (convData?.type === 'group' && convId) {
        // PRIORITY 1: Groups ALWAYS use conversation_id, never contact_id
        console.log("Loading group messages by conversation_id:", convId);
        // Edge case: If group has contact_id, ignore it
        if (convData?.contact_id) {
          console.warn("⚠️ Group conversation has contact_id - ignoring it as groups should not use contact_id", {
            conversationId: convId,
            contactId: convData?.contact_id
          });
        }
        dbMessages = await chatApi.getMessagesByConversation(convId);
        setMergedConversationCount(1);
      } else if (propContactId) {
        // PRIORITY 2: Use merged messages for direct chats when contactId is provided
        console.log("Loading merged messages by contact_id:", propContactId);
        dbMessages = await chatApi.getMergedMessagesByContact(propContactId);
        const conversations = await chatApi.getConversationsByContact(propContactId);
        setMergedConversationCount(conversations.length);
      } else if (convData?.contact_id && convData?.type !== 'group') {
        // PRIORITY 3: Use merged messages for direct chats with contact_id
        console.log("Loading merged messages by convData.contact_id:", convData?.contact_id);
        dbMessages = await chatApi.getMergedMessagesByContact(convData?.contact_id);
        const conversations = await chatApi.getConversationsByContact(convData?.contact_id);
        setMergedConversationCount(conversations.length);
      } else if (convId) {
        // PRIORITY 4: Fallback to conversation_id for direct chats
        console.log("Loading direct messages by conversation_id:", convId);
        dbMessages = await chatApi.getMessagesByConversation(convId);
        setMergedConversationCount(1);
      } else if (convData?.jid) {
        // PRIORITY 5: For temporary conversations (non-saved contacts), load by JID
        console.log("Loading messages by JID:", convData?.jid);
        dbMessages = await chatApi.getMessagesByJid(convData?.jid);
        setMergedConversationCount(1);
      } else {
        // No way to load messages
        dbMessages = [];
        setMergedConversationCount(0);
      }
      
      // Convert database messages to display format
      console.log("Raw messages from API:", dbMessages);
      
      // Ensure dbMessages is always an array
      if (!Array.isArray(dbMessages)) {
        console.error("❌ dbMessages is not an array:", typeof dbMessages, dbMessages);
        dbMessages = [];
      }
      
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
        quotedFromMe: msg.quoted_from_me,
        // Group message fields
        pushName: msg.push_name,
        senderJid: msg.sender_jid,
        isGroupMessage: msg.is_group_message
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

  // Load messages on component mount and when dependencies change
  useEffect(() => {
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
      console.log('Current conversation ID:', conversationId);
      console.log('Message conversation_id:', data.conversation_id);
      console.log('Current chat messages count:', chatMessages.length);
      
      // Check if this message belongs to the current conversation
      if (data.conversation_id && data.conversation_id !== conversationId) {
        console.log('❌ Message not for current conversation, ignoring');
        return;
      }
      
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
          quotedFromMe: data.quoted_from_me,
          // Group message fields
          pushName: data.push_name,
          senderJid: data.sender_jid,
          isGroupMessage: data.is_group_message
        };

        const updatedMessages = [...prev, newMessage].sort((a, b) => 
          a.timestamp.getTime() - b.timestamp.getTime()
        );
        console.log('Updated messages count:', updatedMessages.length);
        
        return updatedMessages;
      });
    });

    // Listen for contact updates (new messages, contact changes)
    socket.on('contact_update', (data: any) => {
      console.log('🔔 Contact update received:', data);
      
      // Refresh the contact list to show latest message at top
      if (onContactUpdate) {
        onContactUpdate(data);
      }
    });

    socket.on('disconnect', () => {
      console.log('Socket.IO connection closed');
    });

    // Cleanup on unmount
    return () => {
      console.log('Cleaning up socket connection');
      socket.disconnect();
    };
  }, [conversationId, propContactId, allConversationIds, onContactUpdate]);

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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showContactMenu) {
        const target = event.target as Element;
        const menu = document.getElementById('contact-menu');
        if (menu && !menu.contains(target)) {
          setShowContactMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showContactMenu]);

  const handleEditContact = () => {
    // Open unified modal in edit mode
    if (conversationData?.contact_id) {
      setUnifiedModalMode('edit');
      setUnifiedModalOpen(true);
    }
  };

  const handleSaveNewContact = () => {
    // Open unified modal in save mode for LID
    if (conversationData?.jid) {
      setUnifiedModalMode('save');
      setUnifiedModalOpen(true);
    }
  };

  // Handle merge for @lid contacts
  const handleMergeClick = () => {
    setUnifiedModalMode('merge');
    setUnifiedModalOpen(true);
  };

  const handleSaveContactClick = () => {
    // Open unified modal in save mode
    setUnifiedModalMode('save');
    setUnifiedModalOpen(true);
  };

  // Info modal handlers
  const handleInfoModalOpen = async () => {
    setShowInfoModal(true);
    setUnmergeLoading(true);
    
    try {
      console.log('Opening info modal with conversationData:', conversationData);
      
      if (conversationData?.contact_id) {
        console.log('Fetching conversations for contact_id:', conversationData.contact_id);
        // Get all conversations for this contact
        const conversations = await chatApi.getConversationsByContact(conversationData.contact_id);
        console.log('Fetched conversations:', conversations);
        setMergedConversations(conversations);
        setMergedConversationCount(conversations.length);
        
        console.log('Fetching contacts list...');
        // Get contact details to show proper name and phone
        const contacts = await chatApi.getContacts();
        console.log('Fetched contacts:', contacts);
        const contact = contacts.find(c => c.id === conversationData.contact_id);
        console.log('Found contact:', contact);
        if (contact) {
          // Update conversationData with proper contact info
          setConversationData((prev: any) => ({
            ...prev,
            display_name: contact.display_name,
            phone_number: contact.phone_number
          }));
          console.log('Updated conversationData with contact info');
        } else {
          console.log('Contact not found for ID:', conversationData.contact_id);
        }
      } else if (conversationData?.jid) {
        console.log('No contact_id, showing single conversation for JID:', conversationData.jid);
        // For non-merged conversations, just show current JID
        const singleConversation = [{
          id: conversationId,
          jid: conversationData.jid,
          type: getConversationType(conversationData.jid),
          is_primary: true
        }];
        setMergedConversations(singleConversation);
        setMergedConversationCount(1);
      }
    } catch (error) {
      console.error('Error fetching conversation info:', error);
    } finally {
      setUnmergeLoading(false);
    }
  };

  const getConversationType = (jid: string) => {
    if (jid.endsWith('@s.whatsapp.net')) return 'WhatsApp';
    if (jid.endsWith('@lid')) return 'LID';
    if (jid.endsWith('@g.us')) return 'Group';
    if (jid.includes('@broadcast')) return 'Broadcast';
    return 'Unknown';
  };

  const handleUnmergeConversation = async (conversationToUnmerge: any) => {
    // Confirm before unmerging
    const confirmed = window.confirm(
      `Are you sure you want to unmerge ${conversationToUnmerge.jid} from this conversation? This will create a separate conversation for this JID.`
    );
    
    if (!confirmed) return;
    
    setUnmergeLoading(true);
    
    try {
      // Create a new contact for the unmerged conversation
      const newContactName = `Unmerged - ${conversationToUnmerge.jid}`;
      
      // Use the unmerge API
      const result = await chatApi.unmergeConversation(conversationToUnmerge.id, newContactName);
      
      if (result.success) {
        // Refresh the conversation info
        await handleInfoModalOpen();
        
        // Reload messages if this is the current conversation
        if (conversationToUnmerge.id === conversationId) {
          await loadMessages();
        }
        
        // Show success message
        alert('Conversation unmerged successfully!');
      }
    } catch (error) {
      console.error('Error unmerging conversation:', error);
      alert('Failed to unmerge conversation. Please try again.');
    } finally {
      setUnmergeLoading(false);
    }
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
                   conversationData?.jid?.replace(/@s\.whatsapp\.net|@lid|@g\.us|@broadcast/g, '') ||
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
      
      <div className="flex flex-col h-full bg-[#efeae2] dark:bg-[#0b141a] w-full overflow-hidden">
        {/* Chat Header - Frosted translucent with rounded corners */}
        <div className="sticky top-0 z-20 mx-4 mt-3 mb-2 flex-shrink-0">
          <div className="backdrop-blur-xl bg-[#075e54]/85 dark:bg-[#0b141a]/85 px-4 py-3 flex items-center justify-between rounded-2xl shadow-lg shadow-black/20 border border-white/10">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 bg-[#128c7e] rounded-full flex items-center justify-center shadow-md flex-shrink-0">
                {conversationData?.profile_pic_url ? (
                  <img
                    src={conversationData.profile_pic_url}
                    className="w-10 h-10 rounded-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                      if (nextElement) {
                        nextElement.classList.remove('hidden');
                      }
                    }}
                    onClick={() => {
                      setProfilePreview({
                        url: conversationData.profile_pic_url!,
                        name: (() => {
                    const nameInfo = formatDisplayName(conversationData);
                    return nameInfo.showTilde ? `~${nameInfo.text}` : nameInfo.text;
                  })() || conversationData.phone_number || 'Unknown'
                      });
                    }}
                  />
                ) : conversationData?.resolved_display_name || conversationData?.contact_display_name ? (
                  <span className="text-white font-semibold text-sm">
                    {getFirstLetterForAvatar(conversationData?.resolved_display_name || conversationData?.contact_display_name)}
                  </span>
                ) : conversationData?.display_name && conversationData.display_name !== null ? (
                  <span className="text-white font-semibold text-sm">
                    {getFirstLetterForAvatar(conversationData.display_name)}
                  </span>
                ) : (
                  <span className="text-white font-semibold text-sm">
                    {getFirstLetterForAvatar(conversationData?.display_name) || 
                     conversationData?.phone_number?.charAt(0) || 
                     conversationData?.jid?.charAt(0)?.toUpperCase() || 
                     '?'}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-white drop-shadow-sm truncate flex items-center gap-2">
                  {(() => {
                    const nameInfo = formatDisplayName(conversationData);
                    return (
                      <>
                        {nameInfo.showTilde && <span className="text-white/70">~</span>}
                        <span className={nameInfo.isPushName ? "font-normal" : "font-bold"}>
                          {nameInfo.text}
                        </span>
                      </>
                    );
                  })()}
                </h2>
                <p className="text-xs text-[#dcf8c6]/90 truncate">
                  {conversationData?.type === 'group' ? (
                    (() => {
                      const participants = getGroupParticipants();
                      
                      if (participants.length === 1 && participants[0] === 'You') return 'You';
                      
                      const display = participants.slice(0, 3).join(', ');
                      return participants.length > 3 ? `${display}...` : display;
                    })()
                  ) : conversationData?.source_jid && conversationData.source_jid !== conversationData.jid ? (
                    <>
                      {/* For mapped contacts, show their phone; for unmapped/auto-generated, show nothing or raw JID */}
                      {conversationData?.contact_is_auto_generated 
                        ? conversationData?.jid 
                        : (conversationData?.contact_phone || formatPhoneNumberDisplay(conversationData?.phone_number) || conversationData?.jid)}
                      <span className="ml-1 opacity-75">(from: {conversationData.source_jid})</span>
                    </>
                  ) : (
                    /* Don't show phone for auto-generated contacts - they come from broadcast/g.us and aren't real saved contacts */
                    conversationData?.contact_is_auto_generated 
                      ? conversationData?.jid 
                      : (conversationData?.contact_phone || formatPhoneNumberDisplay(conversationData?.phone_number) || conversationData?.lid || conversationData?.jid || 'No number')
                  )}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Three-dot Menu Button */}
              <div className="relative">
                <button
                  onClick={() => setShowContactMenu(!showContactMenu)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                >
                  <MoreVertical className="w-4 h-4 text-white" />
                </button>
                
                {/* Dropdown Menu */}
                {showContactMenu && (
                  <div id="contact-menu" className="absolute right-0 top-full mt-1 bg-white dark:bg-[#202c33] rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-48 z-50">
                    {/* Contact is saved */}
                    {conversationData?.contact_id && conversationData?.type !== 'group' && (
                      <>
                        <button
                          onClick={() => {
                            setShowContactMenu(false);
                            // Handle edit contact
                            handleEditContact();
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span>Edit Contact</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowContactMenu(false);
                            // Handle merge contact
                            handleMergeClick();
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span>Merge Contact</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowContactMenu(false);
                            // Handle conversation info
                            handleInfoModalOpen();
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span>Info</span>
                        </button>
                      </>
                    )}
                    
                    {/* Group conversations - only show Info */}
                    {conversationData?.type === 'group' && (
                      <button
                        onClick={() => {
                          setShowContactMenu(false);
                          // Handle conversation info
                          handleInfoModalOpen();
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                      >
                        <span>Info</span>
                      </button>
                    )}
                    
                    {/* Contact is not saved */}
                    {!conversationData?.contact_id && conversationData?.type !== 'group' && (
                      <>
                        {conversationData?.jid?.endsWith('@s.whatsapp.net') && (
                          <button
                            onClick={() => {
                              setShowContactMenu(false);
                              handleSaveContactClick();
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <span>Save Contact</span>
                          </button>
                        )}
                        
                        {conversationData?.jid && (
                          <button
                            onClick={() => {
                              setShowContactMenu(false);
                              handleInfoModalOpen();
                            }}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                          >
                            <span>Info</span>
                          </button>
                        )}
                        
                        {conversationData?.jid?.endsWith('@lid') && (
                          <>
                            <button
                              onClick={() => {
                                setShowContactMenu(false);
                                handleMergeClick();
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <span>Merge Contact</span>
                            </button>
                            <button
                              onClick={() => {
                                setShowContactMenu(false);
                                handleSaveNewContact();
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <span>Save New Contact</span>
                            </button>
                          </>
                        )}
                        
                        {conversationData?.jid?.endsWith('@g.us') && (
                          <>
                            <button
                              onClick={() => {
                                setShowContactMenu(false);
                                handleSaveContactClick();
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <span>Save Contact</span>
                            </button>
                            <button
                              onClick={() => {
                                setShowContactMenu(false);
                                handleMergeClick();
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                            >
                              <span>Merge Contact</span>
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Unmapped @lid Info Banner */}
        {conversationData?.jid?.endsWith('@lid') && !conversationData?.contact_id && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 p-3 mb-2">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <span className="font-semibold">Unmapped Contact:</span> This contact is not yet saved. 
      
                    Save Contact
          
                  {' '}to display the contact name and link conversations.
                </div>
              </div>
            </div>
          </div>
        )}

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

        {/* Merged Conversation Banner */}
        {conversationData?.contact_id && mergedConversationCount > 1 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 p-3 mb-2">
            <div className="flex items-center">
              <div className="flex-1">
                <div className="text-sm text-blue-800 dark:text-blue-200">
                  <span className="font-semibold">Merged Conversation:</span> Showing messages from {mergedConversationCount} conversations
                  {conversationData.phone_number && (
                    <span className="ml-2">({formatPhoneNumberDisplay(conversationData.phone_number)})</span>
                  )}
                  <div className="mt-1 text-xs text-blue-600 dark:text-blue-300">
                    JIDs: {mergedConversations.map(conv => conv.jid).join(', ')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Messages Area - WhatsApp Style */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 min-h-0 relative">
          {isLoading ? (
            <div className="flex-1 h-full">
              <Loader type="chat" />
            </div>
          ) : chatMessages.length === 0 ? (
            <div className="flex justify-center items-center h-full">
              <div className="text-gray-500 dark:text-gray-400 text-center">
                {conversationData?.contact_id && !propContactId ? (
                  // This is a merged conversation - show merge info
                  <div className="max-w-md">
                    <div className="mb-4">
                      <div className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        This conversation has been merged
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        Merged with: {conversationData.display_name || 'Unknown Contact'}
                        {conversationData.phone_number && (
                          <span className="block mt-1">Phone: {formatPhoneNumberDisplay(conversationData.phone_number)}</span>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          // Navigate to the merged contact's conversation
                          navigate(`/contacts/${conversationData.contact_id}`);
                        }}
                        className="bg-[#008069] hover:bg-[#006953] text-white px-4 py-2 rounded-lg transition-colors"
                      >
                        View Merged Conversation
                      </button>
                    </div>
                  </div>
                ) : (
                  // Regular empty conversation
                  <>
                    <div className="mb-2">No messages yet</div>
                    <div className="text-sm">Start conversation!</div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* All Messages with Day Separators */}
              {chatMessages.map((chatMessage, index) => {
                const previousMessage = chatMessages[index - 1];
                const isGrouped = previousMessage && previousMessage.isOutgoing === chatMessage.isOutgoing;
                const showDaySeparator = needsDaySeparator(chatMessage, previousMessage);
                
                return (
                  <React.Fragment key={chatMessage.id}>
                    {/* Day Separator */}
                    {showDaySeparator && (
                      <div className="flex justify-center my-4">
                        <div className="bg-[#e9edef] dark:bg-[#2a3942] px-3 py-1 rounded-full">
                          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                            {formatDaySeparator(chatMessage.timestamp)}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {/* Message */}
                    <div 
                      ref={(el) => {
                        if (el) messageRefs.current.set(chatMessage.id, el);
                      }}
                      className={`flex ${chatMessage.isOutgoing ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-0.5' : 'mt-2'} group`}
                    >
                      <div
                        className={`relative max-w-[70%] px-2 py-1.5 rounded-lg text-sm hover:shadow-md transition-shadow duration-200 ${
                          chatMessage.isOutgoing 
                            ? 'bg-[#d9fdd3] text-black dark:bg-[#005c4b] dark:text-white' 
                            : 'bg-white text-black dark:bg-[#202c33] dark:text-white'
                        } ${
                          chatMessage.isOutgoing 
                            ? (isGrouped ? 'rounded-tr-lg' : 'rounded-tr-none')
                            : (isGrouped ? 'rounded-tl-lg' : 'rounded-tl-none')
                        }`}
                      >

                        {/* ✅ Sender Name (WhatsApp style) */}
                        {!chatMessage.isOutgoing && (conversationData?.type === 'group' || chatMessage.pushName || chatMessage.senderJid) && (
                          <div
                            className="text-[13px] font-semibold mb-0.5"
                            style={{
                              color: getColorFromString(
                                chatMessage.senderJid || chatMessage.pushName || 'default'
                              )
                            }}
                          >
                            {(() => {
                              // First try pushName (from broadcast/group messages)
                              if (chatMessage.pushName) {
                                return `~ ${chatMessage.pushName}`;
                              }
                              
                              // Then try to find contact by senderJid and use display_name
                              if (chatMessage.senderJid) {
                                const contact = contacts.find(c => c.primary_jid === chatMessage.senderJid);
                                if (contact?.display_name) {
                                  return contact.is_auto_generated ? `~ ${contact.display_name}` : contact.display_name;
                                }
                              }
                              
                              // Fallback to senderJid or Unknown
                              return chatMessage.senderJid || 'Unknown';
                            })()}
                          </div>
                        )}

                        {/* Quoted Message */}
                        {chatMessage.quotedText && (
                          <div className={`mb-1 px-2 py-1 rounded-md text-xs border-l-4 ${
                            chatMessage.isOutgoing 
                              ? 'bg-[#cfe9ba] border-green-600 dark:bg-[#004d3a] dark:border-green-500'
                              : 'bg-[#f0f2f5] border-[#00a884] dark:bg-[#2a3942] dark:border-[#00a884]'
                          }`}>
                            <div className="font-semibold text-[11px] text-[#00a884]">
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

                        {/* Time */}
                        <div className="flex justify-end items-end gap-1 mt-1">
                          <span className="text-[10px] opacity-60">
                            {formatISTTime(chatMessage.timestamp)}
                          </span>
                          {chatMessage.isOutgoing && (
                            <svg viewBox="0 0 24 24" className="w-3 h-3 opacity-60" fill="currentColor">
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                            </svg>
                          )}
                        </div>

                        {/* Reply Button */}
                        <button
                          onClick={() => handleQuoteMessage(chatMessage)}
                          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200 p-1 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600"
                        >
                          <Reply className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                        </button>
                      </div>
                    </div>
                  </React.Fragment>
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
          <div className="bg-white dark:bg-[#202c33] border-t border-[#e9edef] dark:border-[#2a3942] flex-shrink-0">
            {/* Quoted Message Preview */}
            {quotedMessage && (
              <div className="bg-white dark:bg-[#202c33] px-4 py-2 border-l-4 border-[#00a884] flex justify-between items-start">
                <div className="flex-1 min-w-0">
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
                className="bg-[#00a884] hover:bg-[#008069] disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-full p-2 transition-colors disabled:cursor-not-allowed flex-shrink-0"
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
                      {formatPhoneNumberDisplay(conversationData?.phone_number) || conversationData?.jid || 'No number'}
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
        
        {/* Profile Picture Preview Modal */}
        <ProfilePicPreviewModal
          isOpen={!!profilePreview}
          imageUrl={profilePreview?.url || null}
          contactName={profilePreview?.name || ''}
          onClose={() => setProfilePreview(null)}
        />
        
        {/* Unified Contact Modal */}
        <UnifiedContactModal
          isOpen={unifiedModalOpen}
          onClose={() => setUnifiedModalOpen(false)}
          mode={unifiedModalMode}
          jid={conversationData?.jid}
          contactId={conversationData?.contact_id}
          existingContact={conversationData}
          onSuccess={async () => {
            // Refresh conversation data after modal action
            if (conversationId) {
              const conversations: ApiContact[] = await chatApi.getConversations();
              const conv = conversations.find(c => c.conversation_id === conversationId);
              
              // If this conversation now has a contact_id, fetch the contact details
              if (conv?.id) {
                try {
                  const contacts = await chatApi.getContacts();
                  const contact = contacts.find(c => c.id === conv.id);
                  
                  if (contact) {
                    // Update conversationData with proper contact info
                    setConversationData({
                      ...conv,
                      display_name: contact.display_name,
                      phone_number: contact.phone_number
                    });
                  } else {
                    setConversationData(conv);
                  }
                  
                  // Fetch all conversation IDs for socket rooms
                  if (conv.type === 'group') {
                    // For groups, use the single conversation ID
                    setConversationData((prev: any) => prev ? {...prev, allConversationIds: [conv.conversation_id || conv.id]} : null);
                  } else {
                    // For direct conversations, fetch all linked conversations
                    const contactConversations = await chatApi.getConversationsByContact(conv.id);
                    setConversationData((prev: any) => prev ? {...prev, allConversationIds: contactConversations.map((c: any) => c.id)} : null);
                  }
                } catch (error) {
                  console.error('Error fetching contact conversations:', error);
                  setConversationData(conv);
                }
              } else {
                setConversationData(conv);
              }
              
              // Reload messages to show merged conversations
              await loadMessages();
            }
          }}
        />
        
        {/* Conversation Info Modal */}
        {showInfoModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#202c33] w-full max-w-md max-h-[90vh] rounded-lg overflow-y-auto">
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Conversation Info
                </h3>
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-4">
                {unmergeLoading ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader type="chat" />
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      {conversationData?.type === 'group' ? (
                        <>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Group Name: {conversationData?.group_name || conversationData?.display_name || 'Unknown Group'}
                          </h4>
                        </>
                      ) : (
                        <>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Contact: {conversationData?.display_name || 'Unknown'}
                          </h4>
                          {conversationData?.phone_number && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Phone: {formatPhoneNumberDisplay(conversationData.phone_number)}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      {conversationData?.type === 'group' ? (
                        <>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Participants
                          </h4>
                          
                          {(() => {
                            const participants = getGroupParticipants();
                            
                            if (participants.length === 0) {
                              return (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  No participants found
                                </p>
                              );
                            }
                            
                            return (
                              <div className="space-y-1">
                                {participants.map((participant, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                                  >
                                    <span className="text-sm text-gray-900 dark:text-white">
                                      {participant}
                                    </span>
                                    {participant !== 'You' && (
                                      <span className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                                        {(() => {
                                          const participantMsg = chatMessages.find(msg => 
                                            !msg.isOutgoing && (
                                              msg.pushName === participant.replace('~', '') || 
                                              msg.senderJid?.includes(participant.replace('~', ''))
                                            )
                                          );
                                          return participantMsg?.senderJid || 'Unknown JID';
                                        })()}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ); 
                          })()}
                        </>
                      ) : (
                        <>
                          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Merged Conversations ({mergedConversations.length})
                          </h4>
                          
                          {mergedConversations.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              No conversations found
                            </p>
                          ) : (
                            mergedConversations.map((conv) => (
                              <div
                                key={conv.id}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                                      {conv.type}
                                    </span>
                                    {conv.is_primary && (
                                      <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 px-2 py-1 rounded">
                                        Primary
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 dark:text-gray-400 font-mono">
                                    {conv.jid}
                                  </p>
                                </div>
                                
                                {!conv.is_primary && mergedConversations.length > 1 && (
                                  <button
                                    onClick={() => handleUnmergeConversation(conv)}
                                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1"
                                    title="Unmerge this conversation"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ))
                          )}
                        </>
                      )}
                    </div>
                    
                    {conversationData?.type !== 'group' && mergedConversations.length > 1 && (
                      <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                          <p className="text-xs text-yellow-800 dark:text-yellow-200">
                            Unmerging a conversation will create a separate contact and conversation for that JID. This action cannot be undone.
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
