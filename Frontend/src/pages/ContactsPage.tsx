import React, { useState, useEffect } from 'react';
import { Users, Search, Edit } from 'lucide-react';
import { chatApi } from '../services/chatApi';
import { ChatInterface } from '../components/chat/ChatInterface';
import { EditContactModal } from '../components/common/EditContactModal';
import { Loader } from '../components/common/Loader';

interface Contact {
  id: number;
  display_name: string;
  phone_number: string;
  conversation_id: number | null;
  last_message_at: string | null;
  unread_count: number;
}

interface MergedContact extends Contact {
  all_conversation_ids: number[];
  total_unread_count: number;
  last_message_preview?: string;
  last_message_from_me?: boolean;
}

export const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<MergedContact[]>([]);
  const [selectedContact, setSelectedContact] = useState<MergedContact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  useEffect(() => {
    loadContacts();
    
    // Set up periodic refresh for unread counts
    const interval = setInterval(() => {
      loadContacts();
    }, 10000); // Refresh every 10 seconds
    
    return () => clearInterval(interval);
  }, []);

  const loadContacts = async () => {
    try {
      const contactsData = await chatApi.getContacts();
      
      // Merge conversations by phone number
      const mergedContactsMap = new Map<string, MergedContact>();
      
      contactsData.forEach((contact: Contact) => {
        const key = contact.phone_number;
        
        if (mergedContactsMap.has(key)) {
          // Update existing merged contact
          const existing = mergedContactsMap.get(key)!;
          existing.all_conversation_ids.push(contact.conversation_id!);
          existing.total_unread_count += contact.unread_count;
          
          // Use the most recent conversation
          if (contact.last_message_at && 
              (!existing.last_message_at || 
               new Date(contact.last_message_at) > new Date(existing.last_message_at))) {
            existing.last_message_at = contact.last_message_at;
            existing.conversation_id = contact.conversation_id;
          }
        } else {
          // Create new merged contact
          mergedContactsMap.set(key, {
            ...contact,
            all_conversation_ids: contact.conversation_id ? [contact.conversation_id] : [],
            total_unread_count: contact.unread_count
          });
        }
      });
      
      const mergedContacts = Array.from(mergedContactsMap.values());
      
      // Fetch last message for each merged contact
      const contactsWithLastMessage = await Promise.all(
        mergedContacts.map(async (contact) => {
          let lastMessagePreview = '';
          let lastMessageFromMe = false;
          
          // Get the most recent conversation
          if (contact.conversation_id) {
            try {
              const messages = await chatApi.getMessagesByConversation(contact.conversation_id);
              if (messages.length > 0) {
                const lastMessage = messages[messages.length - 1];
                lastMessagePreview = lastMessage.message_text || '';
                lastMessageFromMe = lastMessage.from_me;
              }
            } catch (error) {
              console.error('Error fetching last message:', error);
            }
          }
          
          return {
            ...contact,
            last_message_preview: lastMessagePreview,
            last_message_from_me: lastMessageFromMe
          };
        })
      );
      
      // Sort by latest message timing (most recent first) - exactly like WhatsApp
      contactsWithLastMessage.sort((a, b) => {
        // Handle null/undefined dates
        const dateA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const dateB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        
        // Sort in descending order (most recent first)
        return dateB - dateA;
      });
      
      setContacts(contactsWithLastMessage);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phone_number.includes(searchQuery)
  );


  const handleContactClick = async (contact: MergedContact) => {
    setSelectedContact(contact);
    
    // Reset unread counts for all conversations of this contact
    if (contact.all_conversation_ids.length > 0) {
      try {
        // Reset unread count on backend for all conversations
        await Promise.all(
          contact.all_conversation_ids.map(convId => 
            chatApi.markConversationRead(convId)
          )
        );
        
        // Update local state to show unread count as 0
        setContacts(prev => prev.map(c => 
          c.id === contact.id ? { ...c, total_unread_count: 0 } : c
        ));
      } catch (error) {
        console.error('Error resetting unread count:', error);
      }
    }
    
    // Use the most recent conversation ID from the merged contact
    let conversationId = contact.conversation_id;  
    
    // If no conversation exists, create one
    if (!conversationId) {
      conversationId = await chatApi.getConversationByContact(contact.id);
      if (conversationId) {
        // Update contact with new conversation_id
        setContacts(prev => prev.map(c => 
          c.id === contact.id ? { ...c, conversation_id: conversationId } : c
        ));
      }
    }
    
    // Update selected contact with conversation ID
    if (conversationId) {
      setSelectedContact(prev => prev ? { ...prev, conversation_id: conversationId } : null);
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
  };

  const handleCloseEditModal = () => {
    setEditingContact(null);
  };

  const handleContactUpdate = () => {
    loadContacts(); // Reload contacts to show updated data
    setEditingContact(null);
  };

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900">
      {/* Left Panel - Contacts List */}
      <div className="w-96 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
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
        <div className="flex-1 overflow-y-auto">
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
                <div className="w-12 h-12 bg-[#128c7e] dark:bg-[#005c4b] rounded-full flex items-center justify-center mr-3">
                  <span className="text-white font-semibold">
                    {contact.display_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                
                {/* Contact Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {contact.display_name}
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
        </div>
      </div>

      {/* Right Panel - Chat Interface */}
      <div className="flex-1 flex flex-col">
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
          isOpen={true}
          onClose={handleCloseEditModal}
          contact={editingContact}
          onUpdate={handleContactUpdate}
        />
      )}
    </div>
  );
};
