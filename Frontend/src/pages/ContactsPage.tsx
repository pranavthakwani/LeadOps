import React, { useState, useEffect, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import { Search, Phone, MessageCircle, Check, CheckCheck, Plus, Users, Edit } from 'lucide-react';
import { chatApi } from '../services/chatApi';
import { Loader } from '../components/common/Loader';
import { formatPhoneNumberDisplay } from '../utils/phoneUtils';
import { getFirstLetterForAvatar } from '../utils/avatarUtils';
import { UnifiedContactModal } from '../components/common/UnifiedContactModal';
import { ProfilePicPreviewModal } from '../components/common/ProfilePicPreviewModal';
import { ChatInterface } from '../components/chat/ChatInterface';

interface Contact {
  id: number;
  display_name: string;
  phone_number: string;
  primary_jid: string;
  is_auto_generated?: boolean;
  conversation_id: number | null;
  last_message_at: string | null;
  unread_count: number;
}

interface MergedContact extends Contact {
  primary_jid: string;
  all_conversation_ids: number[];
  total_unread_count: number;
  last_message_preview?: string;
  last_message_from_me?: boolean;
  last_message_text?: string;
  profile_pic_url?: string;
}

export const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<MergedContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<MergedContact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [unifiedModalOpen, setUnifiedModalOpen] = useState(false);
  const [unifiedModalMode, setUnifiedModalMode] = useState<'save' | 'edit' | 'merge'>('save');
  const [unifiedModalJid, setUnifiedModalJid] = useState<string>();
  const [unifiedModalContactId, setUnifiedModalContactId] = useState<number>();
  const [unifiedModalExistingContact, setUnifiedModalExistingContact] = useState<Contact | null>(null);
  const [profilePreview, setProfilePreview] = useState<{ url: string; name: string } | null>(null);
  const [contactsWidth, setContactsWidth] = useState(384); // Default 24rem (384px)
  const socketRef = useRef<any>(null);

  // Helper function to format contact display name
  const formatContactDisplayName = (contact: Contact) => {
    if (contact.display_name && contact.display_name !== 'Unknown' && contact.display_name !== null) {
      // Add ~ prefix for auto-generated contacts (from pushName)
      if (contact.is_auto_generated) {
        return `~${contact.display_name}`;
      }
      return contact.display_name;
    }
    // For @lid contacts, show the JID
    if (contact.primary_jid && contact.primary_jid.endsWith('@lid')) {
      return contact.primary_jid;
    }
    return formatPhoneNumberDisplay(contact.phone_number) || 'Unknown';
  };

  // Helper function to get contact display with phone number/JID for auto-generated
  const getContactDisplay = (contact: Contact) => {
    const displayName = formatContactDisplayName(contact);
    // Only show the identifier (phone/JID) for auto-generated contacts that are NOT saved
    if (contact.is_auto_generated && (!contact.display_name || contact.display_name === 'Unknown')) {
      // Show formatted phone number for regular contacts, JID for @lid contacts
      const identifier = contact.phone_number ? formatPhoneNumberDisplay(contact.phone_number) : contact.primary_jid;
      return `${displayName}\n~${identifier}`;
    }
    return displayName;
  };

  // Helper function to check if contact is @lid
  // Note: This function is no longer needed for business badge logic

  // Handle merge completion
  const handleMergeComplete = async () => {
    await loadContacts(1, false);
    setUnifiedModalOpen(false);
  };

  // Handle contact updates from ChatInterface (new messages, etc.)
  const handleContactUpdate = async (data: any) => {
    console.log('🔄 Updating contact due to new message:', data);
    
    // Update the specific contact without refreshing the entire list
    setContacts(prev => {
      const updatedContacts = prev.map(contact => {
        if (contact.id === data.contactId) {
          return {
            ...contact,
            last_message_preview: data.messagePreview || data.last_message_preview,
            last_message_at: new Date().toISOString(), // Update timestamp to move to top
            total_unread_count: (contact.total_unread_count || 0) + 1,
            conversation_id: data.conversation_id
          };
        }
        return contact;
      });
      
      // Move the updated contact to the top
      const updatedContact = updatedContacts.find(c => c.id === data.contactId);
      if (updatedContact) {
        const otherContacts = updatedContacts.filter(c => c.id !== data.contactId);
        return [updatedContact, ...otherContacts];
      }
      
      return updatedContacts;
    });
  };

  useEffect(() => {
    loadContacts();
  }, []);

  // Socket connection for real-time contact updates
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to socket for contact updates');
    });

    // Listen for contact updates
    socket.on('contact_update', (data: any) => {
      console.log('Contact update received:', data);
      
      setContacts(prev => 
        prev.map(contact => 
          contact.id === data.contactId 
            ? { 
                ...contact, 
                last_message_preview: data.last_message_preview,
                last_message_at: data.last_message_at,
                total_unread_count: data.unread_count,
                conversation_id: data.conversation_id
              }
            : contact
        )
      );
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const loadContacts = async (pageNum: number = 1, isLoadMore: boolean = false) => {
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const result = await chatApi.getContactsPaginated(pageNum, 30);
      
      // Backend returns unique contacts with all_conversation_ids as comma-separated string
      const contacts = result.contacts.map(contact => ({
        ...contact,
        total_unread_count: contact.unread_count,
        all_conversation_ids: Array.isArray(contact.all_conversation_ids) 
          ? contact.all_conversation_ids 
          : (contact.all_conversation_ids ? (contact.all_conversation_ids as string).split(',').map((id: string) => parseInt(id.trim())) : []),
        last_message_preview: contact.last_message_text || '',
        last_message_from_me: !!contact.last_message_from_me
      }));
      
      // Backend returns unique contacts, no need to merge
      // Remove duplicates by ID to prevent React key warnings
      const uniqueContacts = contacts.filter((contact, index, self) => 
        self.findIndex(c => c.id === contact.id) === index
      );
      
      if (isLoadMore) {
        // Append to existing contacts and remove duplicates
        setContacts(prev => {
          const combined = [...prev, ...uniqueContacts];
          return combined.filter((contact, index, self) => 
            self.findIndex(c => c.id === contact.id) === index
          );
        });
      } else {
        // Replace all contacts
        setContacts(uniqueContacts);
      }

      setHasMore(result.pagination.hasMore);
      setPage(pageNum);
      
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    (contact.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) || false) ||
    (contact.phone_number?.includes(searchQuery) || false) ||
    (contact.primary_jid?.includes(searchQuery) || false)
  );

  const handleContactClick = async (contact: MergedContact) => {
    // Check if this is an unknown contact (auto-generated with no display name)
    if (contact.is_auto_generated && (!contact.display_name || contact.display_name === 'Unknown')) {
      // Show UnifiedContactModal for unknown contacts
      setUnifiedModalMode('save');
      setUnifiedModalJid(contact.primary_jid);
      setUnifiedModalExistingContact(null);
      setUnifiedModalContactId(undefined);
      setUnifiedModalOpen(true);
      return;
    }

    setSelectedContact(contact);
    // Mark all conversations as read when contact is selected
    await Promise.all(
      contact.all_conversation_ids.map(convId => chatApi.markConversationRead(convId))
    );
    
    // Update local state to reflect read status
    setContacts(prev => prev.map(c => 
      c.phone_number === contact.phone_number 
        ? { ...c, total_unread_count: 0 }
        : c
    ));
  };

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadContacts(page + 1, true);
    }
  };

  const handleEditContact = (contact: Contact) => {
    setUnifiedModalMode('edit');
    setUnifiedModalJid(contact.primary_jid);
    setUnifiedModalExistingContact(contact);
    setUnifiedModalContactId(contact.id);
    setUnifiedModalOpen(true);
  };


  // Resize handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    
    // Store initial mouse position and width
    const startX = e.clientX;
    const startWidth = contactsWidth;
    
    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      
      // Use requestAnimationFrame for smooth updates
      requestAnimationFrame(() => {
        const deltaX = e.clientX - startX;
        const newWidth = startWidth + deltaX;
        
        // Set min and max bounds with smooth clamping
        const clampedWidth = Math.max(300, Math.min(600, newWidth));
        setContactsWidth(clampedWidth);
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };

    // Add event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
    };
  }, []);

  return (
    <div className="flex h-full bg-[#f0f2f5] dark:bg-[#111b21]">
      {/* Left Panel - Contacts List */}
      <div 
        className="bg-[#ffffff] dark:bg-[#202c33] border-r border-[#e9edef] dark:border-[#2a3942] flex flex-col flex-shrink-0 transition-all duration-200 ease-out"
        style={{ width: `${contactsWidth}px` }}
      >
        <div>
          {/* Header */}
          <div className="p-4 border-b border-[#e9edef] dark:border-[#2a3942] flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Chats</h2>
            <button
              onClick={() => {
                setUnifiedModalMode('save');
                setUnifiedModalJid(undefined);
                setUnifiedModalExistingContact(null);
                setUnifiedModalContactId(undefined);
                setUnifiedModalOpen(true);
              }}
              className="w-10 h-10 bg-[#00a884] hover:bg-[#008069] text-white rounded-full flex items-center justify-center transition-colors duration-200 shadow-sm"
              title="New Contact"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
          
          {/* Search Bar */}
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-[#f0f2f5] dark:bg-[#2a3942] text-[#111b21] dark:text-[#e9edef] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#00a884] dark:placeholder-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Contacts List */}
        <div 
          className="flex-1 overflow-y-auto min-h-0"
          onScroll={(e) => {
            const element = e.currentTarget;
            if (element.scrollHeight - element.scrollTop <= element.clientHeight + 100) {
              loadMore();
            }
          }}
        >
          {loading ? (
            <div className="p-4">
              <Loader type="contacts" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[#667781]">
              <Users className="w-12 h-12 mb-4" />
              <p className="text-center">
                {searchQuery ? 'No contacts found' : 'Start a conversation by adding a contact'}
              </p>
            </div>
          ) : (
            filteredContacts.map((contact, index) => (
              <div
                key={`${contact.id}-${contact.primary_jid || index}`}
                onClick={() => handleContactClick(contact)}
                className={`flex items-center p-4 hover:bg-[#f5f6f6] dark:hover:bg-[#2a3942] transition-colors cursor-pointer rounded-lg mx-2 mb-1 ${
                  selectedContact?.id === contact.id 
                    ? 'bg-[#e9edef] dark:bg-[#2a3942]' 
                    : ''
                }`}
              >
                {/* Avatar */}
                {contact.profile_pic_url ? (
                  <img
                    src={contact.profile_pic_url}
                    className="w-12 h-12 rounded-full object-cover mr-3 cursor-pointer hover:opacity-90 transition-opacity"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                      const nextElement = e.currentTarget.nextElementSibling as HTMLElement;
                      if (nextElement) {
                        nextElement.classList.remove('hidden');
                      }
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setProfilePreview({
                        url: contact.profile_pic_url!,
                        name: formatContactDisplayName(contact)
                      });
                    }}
                  />
                ) : (
                  <div className="w-12 h-12 bg-[#00a884] rounded-full flex items-center justify-center mr-3">
                    <span className="text-white font-semibold">
                      {getFirstLetterForAvatar(formatContactDisplayName(contact))}
                    </span>
                  </div>
                )}
                
                {/* Contact Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[#111b21] dark:text-[#e9edef] truncate">
                      {getContactDisplay(contact)}
                    </h3>
                    <div className="flex items-center gap-2">
                      {!contact.is_auto_generated && contact.primary_jid && !contact.primary_jid.includes('@g.us') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditContact(contact);
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
                          title="Edit contact"
                        >
                          <Edit className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </button>
                      )}
                      {/* Removed automatic Business badge for LID contacts */}
                      {contact.total_unread_count > 0 && (
                        <span className="bg-[#00a884] text-white text-xs rounded-full px-2 py-1">
                          {contact.total_unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-[#667781] truncate">
                    {contact.last_message_preview ? (
                      <>
                        {contact.last_message_from_me && (
                          <span className="font-medium">You: </span>
                        )}
                        <span>{contact.last_message_preview}</span>
                      </>
                    ) : (
                      <span className="text-gray-400">No messages yet</span>
                    )}
                  </p>
                </div>
              </div>
            ))
          )}
          
          {/* Load More Indicator */}
          {loadingMore && (
            <div className="p-4 text-center">
              <Loader type="contacts" />
              <p className="text-sm text-[#667781] mt-2">Loading more contacts...</p>
            </div>
          )}
        </div>
      </div>

      {/* Resize Handle */}
      <div 
        className="w-2 bg-[#e9edef] dark:bg-[#2a3942] hover:bg-[#d1d5db] dark:hover:bg-[#3b4a54] cursor-col-resize flex-shrink-0 transition-all duration-150 hover:w-3 relative group"
        onMouseDown={handleMouseDown}
        title="Drag to resize"
      >
        {/* Visual indicator in the middle */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="w-1 h-8 bg-[#8696a0] dark:bg-[#8696a0] rounded-full"></div>
        </div>
      </div>

      {/* Right Panel - Chat Interface - Takes remaining width */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedContact ? (
          <ChatInterface 
            conversationId={selectedContact.conversation_id || (selectedContact.all_conversation_ids?.length > 0 ? selectedContact.all_conversation_ids[0] : undefined)}
            contactId={selectedContact.id}
            allConversationIds={selectedContact.all_conversation_ids}
            onContactUpdate={handleContactUpdate}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <Users className="w-16 h-16 mx-auto mb-4" />
              <p>Select a contact to start messaging</p>
            </div>
          </div>
        )}
      </div>
      
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
        jid={unifiedModalJid}
        contactId={unifiedModalContactId}
        existingContact={unifiedModalExistingContact || undefined}
        onSuccess={handleMergeComplete}
      />
    </div>
  );
};
