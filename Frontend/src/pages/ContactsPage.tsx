import React, { useState, useEffect } from 'react';
import { Users, Search } from 'lucide-react';
import { chatApi } from '../services/chatApi';
import { ChatInterface } from '../components/chat/ChatInterface';

interface Contact {
  id: number;
  display_name: string;
  phone_number: string;
  conversation_id: number | null;
  last_message_at: string | null;
  unread_count: number;
}

export const ContactsPage: React.FC = () => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const contactsData = await chatApi.getContacts();
      setContacts(contactsData);
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


  const handleContactClick = async (contact: Contact) => {
    setSelectedContact(contact);
    
    let conversationId = contact.conversation_id;
    
    // If no conversation exists, create one
    if (!conversationId) {
      conversationId = await chatApi.getConversationByContact(contact.id);
      if (conversationId) {
        // Update the contact with the new conversation_id
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
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-[#128c7e]"
              />
            </div>
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#128c7e] border-t-transparent animate-spin rounded-full"></div>
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
                className="flex items-center p-4 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
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
                    {contact.unread_count > 0 && (
                      <span className="bg-[#128c7e] text-white text-xs rounded-full px-2 py-1">
                        {contact.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {contact.phone_number}
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
          <ChatInterface conversationId={selectedContact.conversation_id || undefined} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <Users className="w-16 h-16 mx-auto mb-4" />
              <p>Select a contact to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
