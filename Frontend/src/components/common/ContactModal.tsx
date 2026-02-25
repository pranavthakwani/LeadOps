import React, { useState, useEffect } from 'react';
import { X, ChevronDown, AlertCircle, UserPlus } from 'lucide-react';
import { countryCodes, getDefaultCountry, createWhatsAppJid, type CountryCode } from '../../data/countryCodes';
import { chatApi } from '../../services/chatApi';

interface Contact {
  id: number;
  display_name: string;
  phone_number: string;
  conversation_id?: number;
  last_message_at?: string;
  unread_count?: number;
}

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  submitButtonText: string;
  onSubmit: (name: string, jid: string) => Promise<void>;
  initialName?: string;
  initialPhone?: string;
  isSubmitting?: boolean;
  conversationId?: number; // Add conversationId for merge functionality
}

export const ContactModal: React.FC<ContactModalProps> = ({
  isOpen,
  onClose,
  title,
  submitButtonText,
  onSubmit,
  initialName = '',
  initialPhone = '',
  isSubmitting = false,
  conversationId
}) => {
  const [contactName, setContactName] = useState(initialName);
  const [contactPhone, setContactPhone] = useState(initialPhone);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(getDefaultCountry());
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [existingContacts, setExistingContacts] = useState<any[]>([]);
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [duplicateNumberContact, setDuplicateNumberContact] = useState<any>(null);
  const [showMergeOption, setShowMergeOption] = useState(false);

  // Reset form when modal opens with new initial values
  useEffect(() => {
    if (isOpen) {
      setContactName(initialName);
      setContactPhone(initialPhone);
      setSelectedCountry(getDefaultCountry());
      setShowCountryDropdown(false);
      setExistingContacts([]);
      setShowNameSuggestions(false);
      setDuplicateNumberContact(null);
      setShowMergeOption(false);
    }
  }, [isOpen, initialName, initialPhone]);

  // Search existing contacts when name changes
  useEffect(() => {
    const searchContacts = async () => {
      if (contactName.trim().length >= 2) {
        try {
          const contacts = await chatApi.getContacts();
          const filtered = contacts.filter((contact: Contact) => 
            contact.display_name.toLowerCase().includes(contactName.toLowerCase())
          );
          setExistingContacts(filtered);
          setShowNameSuggestions(filtered.length > 0);
        } catch (error) {
          console.error('Error searching contacts:', error);
        }
      } else {
        setExistingContacts([]);
        setShowNameSuggestions(false);
      }
    };

    const timeoutId = setTimeout(searchContacts, 300);
    return () => clearTimeout(timeoutId);
  }, [contactName]);

  // Check for duplicate phone number
  useEffect(() => {
    const checkDuplicateNumber = async () => {
      if (contactPhone.trim().length >= 10) {
        try {
          const contacts = await chatApi.getContacts();
          const normalizedPhone = contactPhone.replace(/\D/g, '');
          const duplicate = contacts.find((contact: Contact) => {
            const contactPhone = contact.phone_number.replace(/\D/g, '');
            return contactPhone.includes(normalizedPhone) || normalizedPhone.includes(contactPhone);
          });
          
          if (duplicate) {
            setDuplicateNumberContact(duplicate);
            setShowMergeOption(true);
          } else {
            setDuplicateNumberContact(null);
            setShowMergeOption(false);
          }
        } catch (error) {
          console.error('Error checking duplicate number:', error);
        }
      } else {
        setDuplicateNumberContact(null);
        setShowMergeOption(false);
      }
    };

    const timeoutId = setTimeout(checkDuplicateNumber, 300);
    return () => clearTimeout(timeoutId);
  }, [contactPhone]);

  // Close country dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCountryDropdown) {
        const target = event.target as Element;
        if (!target.closest('.country-dropdown')) {
          setShowCountryDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCountryDropdown]);

  // Format phone number as ----- -----
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digit characters
    const digits = value.replace(/\D/g, '');
    
    // Limit to 10 digits
    const limitedDigits = digits.slice(0, 10);
    
    // Format with space after 5 digits
    if (limitedDigits.length <= 5) {
      return limitedDigits;
    }
    
    return `${limitedDigits.slice(0, 5)} ${limitedDigits.slice(5)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    const formatted = formatPhoneNumber(inputValue);
    setContactPhone(formatted);
  };

  const handleNameSelect = (contact: any) => {
    setContactName(contact.display_name);
    setContactPhone(contact.phone_number);
    setShowNameSuggestions(false);
  };

  const handleMergeContact = async () => {
    if (duplicateNumberContact && conversationId) {
      try {
        // Link the current conversation to the existing contact
        await chatApi.linkContact(conversationId, duplicateNumberContact.id);
        console.log('Conversation linked to existing contact:', duplicateNumberContact);
        onClose();
      } catch (error) {
        console.error('Error linking conversation:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contactPhone.trim()) {
      alert('Please enter a phone number first');
      return;
    }
    
    if (!contactName.trim()) {
      alert('Please enter a contact name');
      return;
    }

    // Check if name already exists
    if (existingContacts.some(c => c.display_name.toLowerCase() === contactName.toLowerCase())) {
      alert('A contact with this name already exists. Please use a different name.');
      return;
    }

    try {
      const jid = createWhatsAppJid(contactPhone.trim(), selectedCountry.dialCode);
      await onSubmit(contactName.trim(), jid);
      
      // Reset form on success
      setContactName('');
      setContactPhone('');
      setSelectedCountry(getDefaultCountry());
      onClose();
    } catch (error) {
      console.error('Error submitting contact:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[480px] max-w-[90vw] mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Warning Note */}
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Please add contact carefully. Verify the phone number before saving to avoid duplicates.
            </p>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Phone Number First */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Phone Number *
            </label>
            <div className="flex gap-2">
              {/* Country Code Dropdown */}
              <div className="relative country-dropdown">
                <button
                  type="button"
                  onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#128c7e] focus:border-[#128c7e] dark:bg-gray-700 dark:text-white min-w-[120px]"
                  disabled={isSubmitting}
                >
                  <span>{selectedCountry.flag}</span>
                  <span className="text-sm">{selectedCountry.dialCode}</span>
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {showCountryDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto min-w-[280px]">
                    {countryCodes.map((country) => (
                      <button
                        key={country.code}
                        type="button"
                        onClick={() => {
                          setSelectedCountry(country);
                          setShowCountryDropdown(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-left"
                      >
                        <span>{country.flag}</span>
                        <span className="text-sm font-medium">{country.dialCode}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400 flex-1">{country.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              {/* Phone Number Input with formatting */}
              <input
                type="tel"
                value={contactPhone}
                onChange={handlePhoneChange}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#128c7e] focus:border-[#128c7e] dark:bg-gray-700 dark:text-white"
                placeholder="12345 67890"
                maxLength={11} // 5 digits + space + 5 digits
                required
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Duplicate Number Warning */}
          {showMergeOption && duplicateNumberContact && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                    Contact with this number already exists:
                  </p>
                  <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                    <UserPlus className="w-4 h-4" />
                    <span>{duplicateNumberContact.display_name} - {duplicateNumberContact.phone_number}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleMergeContact}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                >
                  Merge Contact
                </button>
              </div>
            </div>
          )}
          
          {/* Name Input */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#128c7e] focus:border-[#128c7e] dark:bg-gray-700 dark:text-white"
              placeholder="Enter contact name"
              required
              disabled={isSubmitting}
            />
            
            {/* Name Suggestions Dropdown */}
            {showNameSuggestions && existingContacts.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                {existingContacts.map((contact: any) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => handleNameSelect(contact)}
                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 text-left"
                  >
                    <div className="w-8 h-8 bg-[#128c7e] rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-semibold">
                        {contact.display_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {contact.display_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {contact.phone_number}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={!contactPhone.trim() || !contactName.trim() || isSubmitting}
              className="px-4 py-2 bg-[#128c7e] hover:bg-[#005c4b] disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <span>{submitButtonText}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
