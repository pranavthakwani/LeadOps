import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, Users, UserPlus } from 'lucide-react';
import { chatApi } from '../../services/chatApi';
import { formatPhoneNumberDisplay } from '../../utils/phoneUtils';

// Country codes list
const countryCodes = [
  { code: '+91', name: 'India', flag: '🇮🇳' },
  { code: '+1', name: 'United States', flag: '🇺🇸' },
  { code: '+44', name: 'United Kingdom', flag: '🇬🇧' },
  { code: '+971', name: 'UAE', flag: '🇦🇪' },
  { code: '+966', name: 'Saudi Arabia', flag: '🇸🇦' },
  { code: '+1', name: 'Canada', flag: '🇨🇦' },
  { code: '+61', name: 'Australia', flag: '🇦🇺' },
  { code: '+49', name: 'Germany', flag: '🇩🇪' },
  { code: '+33', name: 'France', flag: '🇫🇷' },
  { code: '+81', name: 'Japan', flag: '🇯🇵' },
  { code: '+86', name: 'China', flag: '🇨🇳' },
  { code: '+82', name: 'South Korea', flag: '🇰🇷' },
  { code: '+65', name: 'Singapore', flag: '🇸🇬' },
  { code: '+60', name: 'Malaysia', flag: '🇲🇾' },
  { code: '+62', name: 'Indonesia', flag: '🇮🇩' },
  { code: '+63', name: 'Philippines', flag: '🇵🇭' },
  { code: '+66', name: 'Thailand', flag: '🇹🇭' },
];

// FormInput component moved outside to prevent re-creation on every render
const FormInput = ({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  type = 'text',
  showCountryCode = false,
  countryCode,
  setCountryCode,
  showCountryDropdown,
  setShowCountryDropdown,
  mode
}: any) => (
  <div className="mb-4">
    <label className="text-sm text-gray-600 dark:text-gray-300">{label}</label>
    {showCountryCode && type === 'tel' ? (
      <div className="flex gap-2 mt-1">
        {/* Country Code Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowCountryDropdown(!showCountryDropdown)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border bg-[#f0f2f5] dark:bg-[#2a3942] text-[#111b21] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00a884] min-w-[100px]"
            disabled={disabled}
          >
            <span>{countryCodes.find(c => c.code === countryCode)?.flag || '🇮🇳'}</span>
            <span className="text-sm">{countryCode}</span>
            <span className="text-xs">▼</span>
          </button>
          
          {showCountryDropdown && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-[#202c33] border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
              {countryCodes.map((country) => (
                <button
                  key={country.code}
                  type="button"
                  onClick={() => {
                    setCountryCode(country.code);
                    setShowCountryDropdown(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                >
                  <span>{country.flag}</span>
                  <span>{country.name}</span>
                  <span className="ml-auto text-gray-500">{country.code}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        
        {/* Phone Number Input */}
        <input
          type="tel"
          value={value}
          disabled={disabled}
          placeholder="Phone number"
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '');
            onChange(digits);
          }}
          className="flex-1 px-3 py-2 rounded-lg border bg-[#f0f2f5] dark:bg-[#2a3942] text-[#111b21] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00a884]"
        />
      </div>
    ) : (
      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        autoFocus={false} // Removed autoFocus to prevent focus issues
        onChange={(e) => {
          if (type === 'tel') {
            const digits = e.target.value.replace(/\D/g, '');
            onChange(digits);
          } else {
            onChange(e.target.value);
          }
        }}
        className="w-full mt-1 px-3 py-2 rounded-lg border bg-[#f0f2f5] dark:bg-[#2a3942] text-[#111b21] dark:text-white focus:outline-none focus:ring-1 focus:ring-[#00a884]"
      />
    )}
  </div>
);

interface Contact {
  id: number;
  display_name: string;
  phone_number: string;
  primary_jid?: string;
}

interface UnifiedContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'save' | 'edit' | 'merge';
  jid?: string;
  contactId?: number;
  existingContact?: any;
  onSuccess?: () => void;
}

export const UnifiedContactModal: React.FC<UnifiedContactModalProps> = ({
  isOpen,
  onClose,
  mode,
  jid,
  contactId,
  existingContact,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  // Get full phone number for database
  const getFullPhoneNumber = () => {
    return countryCode + phoneNumber.replace(/\D/g, '');
  };

  // Set phone number from database value
  const setPhoneFromDb = (dbPhone: string) => {
    const digits = dbPhone.replace(/\D/g, '');
    
    // Try to match with country codes
    for (const country of countryCodes) {
      const code = country.code.replace('+', '');
      if (digits.startsWith(code)) {
        setCountryCode(country.code);
        setPhoneNumber(digits.slice(code.length));
        return;
      }
    }
    
    // Default to +91 if no match
    setCountryCode('+91');
    if (digits.startsWith('91')) {
      setPhoneNumber(digits.slice(2));
    } else {
      setPhoneNumber(digits);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Contact[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [createNewMode, setCreateNewMode] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  useEffect(() => {
    if (isOpen) {
        if (mode === 'save' && jid) {
          if (jid.endsWith('@lid')) {
            // For @lid JIDs, don't auto-fill phone - let user enter it manually
            setPhoneNumber('');
            setName('');
          } else {
            // For @s.whatsapp.net JIDs, extract phone from JID
            const extracted = jid.replace('@s.whatsapp.net', '');
            setPhoneFromDb(extracted || '');
            setName('');
          }
        } else if (mode === 'edit' && existingContact) {
          setName(existingContact.display_name || '');
          setPhoneFromDb(existingContact.phone_number || '');
        } else if (mode === 'merge') {
          setSearchQuery('');
          setSearchResults([]);
          setSelectedContact(null);
          setCreateNewMode(false);
          setCountryCode('+91');
          setPhoneNumber('');
          setName('');
        }
    }
  }, [isOpen, mode, jid, existingContact]);

  // Cleanup search timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (query.trim().length === 0) {
      setSearchResults([]);
      setSelectedContact(null);
      return;
    }

    // Set loading state immediately for better UX
    setSearchResults([]);

    // Debounce search with 300ms delay
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await chatApi.searchContacts(query);
        let contacts = res.contacts || [];
        
        // In merge mode, filter out the current contact to prevent merging with itself
        if (mode === 'merge' && contactId) {
          contacts = contacts.filter((contact: Contact) => contact.id !== contactId);
        }
        
        // Also filter by JID if available (for additional safety)
        if (mode === 'merge' && jid) {
          contacts = contacts.filter((contact: Contact) => contact.primary_jid !== jid);
        }
        
        setSearchResults(contacts);
        
        // Auto-select first result if there are results and no contact is selected
        if (contacts.length > 0 && !selectedContact) {
          setSelectedContact(contacts[0]);
        }
      } catch (error) {
        console.error('Error searching contacts:', error);
        setSearchResults([]);
        setSelectedContact(null);
      }
    }, 300);
  }, [selectedContact, mode, contactId, jid]);

  const handleSaveContact = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!phoneNumber.trim()) {
      setError('Phone number is required');
      return;
    }

    const fullPhone = getFullPhoneNumber();
    if (fullPhone.length < 12) {
      setError('Enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await chatApi.saveContactWithJid(name.trim(), fullPhone, jid || '');
      onSuccess?.();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save contact');
    } finally {
      setLoading(false);
    }
  };

  const handleEditContact = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    if (!phoneNumber.trim()) {
      setError('Phone number is required');
      return;
    }

    const fullPhone = getFullPhoneNumber();
    if (fullPhone.length < 12) {
      setError('Enter a valid phone number');
      return;
    }

    if (!contactId) {
      setError('Invalid contact');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await chatApi.updateContact(contactId, name.trim(), fullPhone);
      onSuccess?.();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to update contact');
    } finally {
      setLoading(false);
    }
  };

  const handleMergeContact = async () => {
    if (!jid) {
      setError('JID required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (createNewMode) {
        if (!name.trim()) {
          setError('Name required');
          setLoading(false);
          return;
        }

        if (!phoneNumber.trim()) {
          setError('Phone number required');
          setLoading(false);
          return;
        }

        const fullPhone = getFullPhoneNumber();
        if (fullPhone.length < 12) {
          setError('Enter valid phone number');
          setLoading(false);
          return;
        }

        // Use the new API to create contact and merge with @lid JID
        await chatApi.mergeLidWithNewContact(name.trim(), fullPhone, jid);
      } else if (selectedContact) {
        // Check if we're merging a merged conversation (has multiple JIDs)
        // If existingContact has allConversationIds array, it's a merged conversation
        if (existingContact?.allConversationIds && existingContact.allConversationIds.length > 1) {
          // This is a merged conversation - merge ALL JIDs to the target contact
          console.log('Merging ALL conversations from merged contact to:', selectedContact.id);
          const result = await chatApi.mergeAllConversations(existingContact.contact_id, selectedContact.id);
          console.log('Merge all result:', result);
        } else {
          // Single JID merge - use existing logic
          await chatApi.mergeJidWithContact(jid, selectedContact.id);
        }
      } else {
        setError('Select contact or create new');
        setLoading(false);
        return;
      }

      onSuccess?.();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Merge failed');
    } finally {
      setLoading(false);
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#202c33] w-full max-w-md max-h-[90vh] rounded-lg overflow-y-auto">
        {/* Header */}
        <div className="flex justify-between p-4 border-b">
          <h2 className="font-semibold">
            {mode === 'save' && 'Save Contact'}
            {mode === 'edit' && 'Edit Contact'}
            {mode === 'merge' && 'Merge Contact'}
          </h2>
          <X onClick={onClose} className="cursor-pointer" />
        </div>

        {/* Body */}
        <div className="p-4">
          {error && <div className="text-red-500 text-sm mb-3">{error}</div>}

          {mode === 'save' && (
            <>
              <FormInput 
                label="Name" 
                value={name} 
                onChange={setName} 
                mode={mode}
              />
              <FormInput 
                label="Phone" 
                value={phoneNumber} 
                showCountryCode={true} 
                type="tel" 
                onChange={setPhoneNumber}
                countryCode={countryCode}
                setCountryCode={setCountryCode}
                showCountryDropdown={showCountryDropdown}
                setShowCountryDropdown={setShowCountryDropdown}
                mode={mode}
              />
            </>
          )}

          {mode === 'edit' && (
            <>
              <FormInput 
                label="Name" 
                value={name} 
                onChange={setName}
                mode={mode}
              />
              <FormInput 
                label="Phone" 
                value={phoneNumber} 
                showCountryCode={true} 
                type="tel" 
                onChange={setPhoneNumber}
                countryCode={countryCode}
                setCountryCode={setCountryCode}
                showCountryDropdown={showCountryDropdown}
                setShowCountryDropdown={setShowCountryDropdown}
                mode={mode}
              />
            </>
          )}

          {mode === 'merge' && (
            <>
              <div className="text-xs mb-2 text-gray-500">
                {jid?.includes('@lid') ? 'LID Account' : 'WhatsApp User'}
              </div>

              {!createNewMode ? (
                <>
                  <div className="max-h-60 overflow-y-auto">
                    <input
                      value={searchQuery}
                      onChange={(e) => handleSearch(e.target.value)}
                      placeholder="Search contact..."
                      className="w-full px-3 py-2 mb-3 rounded bg-[#f0f2f5] dark:bg-[#2a3942]"
                    />

                    <div className="max-h-60 overflow-y-auto">
                      {searchResults.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => setSelectedContact(c)}
                          className={`p-3 cursor-pointer rounded-lg border mb-2 transition-colors ${
                            selectedContact?.id === c.id 
                              ? 'bg-[#e9edef] border-[#128c7e]' 
                              : 'bg-white border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-[#128c7e] rounded-full flex items-center justify-center">
                              <Users className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {c.display_name}
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatPhoneNumberDisplay(c.phone_number)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {searchQuery.trim().length > 0 && searchResults.length === 0 && (
                        <div className="text-center py-4">
                          <div className="text-gray-400 text-sm mb-2">
                            No contacts found for "{searchQuery}"
                          </div>
                          <div className="text-xs text-gray-400">
                            Try searching by name or phone number
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setCreateNewMode(true);
                      setCountryCode('+91');
                      setPhoneNumber('');
                      setName('');
                    }}
                    className="mt-3 text-[#00a884]"
                  >
                    + Merge with New Contact
                  </button>
                </>
              ) : (
                <>
                  <FormInput 
                    label="Name" 
                    value={name} 
                    onChange={setName}
                    mode={mode}
                  />
                  <FormInput 
                    label="Phone" 
                    value={phoneNumber} 
                    showCountryCode={true} 
                    type="tel" 
                    onChange={setPhoneNumber}
                    countryCode={countryCode}
                    setCountryCode={setCountryCode}
                    showCountryDropdown={showCountryDropdown}
                    setShowCountryDropdown={setShowCountryDropdown}
                    mode={mode}
                  />

                  <button
                    onClick={() => setCreateNewMode(false)}
                    className="text-sm text-[#00a884]"
                  >
                    ← Back
                  </button>
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 flex gap-2 border-t">
          <button onClick={onClose} className="flex-1 bg-gray-200 py-2 rounded">
            Cancel
          </button>

          {mode === 'save' && (
            <button
              onClick={handleSaveContact}
              className="flex-1 bg-[#00a884] text-white py-2 rounded"
            >
              Save
            </button>
          )}

          {mode === 'edit' && (
            <button
              onClick={handleEditContact}
              className="flex-1 bg-[#00a884] text-white py-2 rounded"
            >
              Update
            </button>
          )}

          {mode === 'merge' && (
            <button
              onClick={handleMergeContact}
              disabled={!selectedContact && !createNewMode}
              className="flex-1 bg-orange-500 text-white py-2 rounded"
            >
              {createNewMode ? 'Merge with New Contact' : 'Merge'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};