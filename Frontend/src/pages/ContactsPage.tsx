import React, { useState, useEffect } from 'react';
import { Users, Search, Edit } from 'lucide-react';
import { chatApi } from '../services/chatApi';
import { ChatInterface } from '../components/chat/ChatInterface';
import { EditContactModal } from '../components/common/EditContactModal';
import { ProfilePicPreviewModal } from '../components/common/ProfilePicPreviewModal';
import { Loader } from '../components/common/Loader';

interface Contact {
  id: number;
  display_name: string;
  phone_number: string;
  is_auto_generated?: boolean;
  conversation_id: number | null;
  last_message_at: string | null;
  unread_count: number;
}

interface MergedContact extends Contact {
  all_conversation_ids: number[];
  total_unread_count: number;
  last_message_preview?: string;
  last_message_from_me?: boolean;
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
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [profilePreview, setProfilePreview] = useState<{ url: string; name: string } | null>(null);

  // Helper function to format contact display name
  const formatContactDisplayName = (contact: Contact) => {
    if (contact.display_name && contact.display_name !== 'Unknown' && contact.display_name !== null) {
      return contact.display_name;
    }
    return contact.phone_number || 'Unknown';
  };

  // Helper function to get contact display with phone number for auto-generated
  const getContactDisplay = (contact: Contact) => {
    const displayName = formatContactDisplayName(contact);
    if (contact.is_auto_generated && contact.display_name && contact.display_name !== 'Unknown') {
      return `${displayName}\n~${contact.phone_number}`;
    }
    return displayName;
  };

  useEffect(() => {
    loadContacts();
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
      
      // Backend now returns unique contacts, no need to merge
      if (isLoadMore) {
        // Append to existing contacts
        setContacts(prev => [...prev, ...contacts]);
      } else {
        // Replace all contacts
        setContacts(contacts);
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
    (contact.phone_number?.includes(searchQuery) || false)
  );

  const handleContactClick = async (contact: MergedContact) => {
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
    setEditingContact(contact);
  };

  const handleCloseEditModal = () => {
    setEditingContact(null);
  };

  
  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      {/* Left Panel - Contacts List */}
      <div className="w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0">
        <div>
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Contacts</h2>
          </div>
          
          {/* Search Bar */}
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#128c7e]"
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
            <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
              <Users className="w-12 h-12 mb-4" />
              <p className="text-center">
                {searchQuery ? 'No contacts found' : 'Start a conversation by adding a contact'}
              </p>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => handleContactClick(contact)}
                className={`flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer rounded-lg mx-2 mb-1 ${
                  selectedContact?.id === contact.id 
                    ? 'bg-gray-100 dark:bg-gray-700' 
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
                  <div className="w-12 h-12 bg-[#128c7e] dark:bg-[#005c4b] rounded-full flex items-center justify-center mr-3">
                    <span className="text-white font-semibold">
                      {formatContactDisplayName(contact).charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                
                {/* Contact Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {getContactDisplay(contact)}
                    </h3>
                    <div className="flex items-center gap-2">
                      {contact.total_unread_count > 0 && (
                        <span className="bg-[#128c7e] text-white text-xs rounded-full px-2 py-1">
                          {contact.total_unread_count}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditContact(contact);
                        }}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title="Edit contact"
                      >
                        <Edit className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Loading more contacts...</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Chat Interface - Takes remaining width but with max constraint */}
      <div className="flex-1 flex flex-col max-w-[calc(100vw-24rem)] min-w-0">
        {selectedContact ? (
          <ChatInterface 
            conversationId={selectedContact.conversation_id || undefined}
            contactId={selectedContact.id}
            allConversationIds={selectedContact.all_conversation_ids}
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
      
      {/* Edit Contact Modal */}
      {editingContact && (
        <EditContactModal
          isOpen={!!editingContact}
          onClose={handleCloseEditModal}
          contact={editingContact}
          onUpdate={loadContacts}
        />
      )}
      
      {/* Profile Picture Preview Modal */}
      <ProfilePicPreviewModal
        isOpen={!!profilePreview}
        imageUrl={profilePreview?.url || null}
        contactName={profilePreview?.name || ''}
        onClose={() => setProfilePreview(null)}
      />
    </div>
  );
};
