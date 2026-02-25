import React, { useState } from 'react';
import { X, Save, Phone, User, ChevronDown } from 'lucide-react';
import { chatApi } from '../../services/chatApi';
import { countryCodes, getDefaultCountry, createWhatsAppJid, type CountryCode } from '../../data/countryCodes';

interface Contact {
  id: number;
  display_name: string;
  phone_number: string;
  conversation_id?: number | null;
  last_message_at?: string | null;
  unread_count?: number;
}

interface MergedContact extends Contact {
  all_conversation_ids: number[];
  total_unread_count: number;
}

interface EditContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: Contact | MergedContact;
  onUpdate: () => void;
}

export const EditContactModal: React.FC<EditContactModalProps> = ({ 
  isOpen, 
  onClose, 
  contact, 
  onUpdate 
}) => {
  const [displayName, setDisplayName] = useState(contact.display_name);
  const [phoneNumber, setPhoneNumber] = useState(contact.phone_number);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(getDefaultCountry());
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  // Format phone number as ----- -----
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    const limitedDigits = digits.slice(0, 10);
    
    if (limitedDigits.length <= 5) {
      return limitedDigits;
    }
    
    return `${limitedDigits.slice(0, 5)} ${limitedDigits.slice(5)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showCountryDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest('.country-dropdown')) {
          setShowCountryDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCountryDropdown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim() || !phoneNumber.trim()) {
      return;
    }

    setIsSaving(true);
    
    try {
      const success = await chatApi.updateContact(contact.id, displayName.trim(), phoneNumber.trim());
      
      if (success) {
        // If this is a merged contact, update all linked conversations
        if ('all_conversation_ids' in contact && contact.all_conversation_ids.length > 0) {
          console.log(`Updating ${contact.all_conversation_ids.length} conversations for contact ${contact.id}`);
          
          // Update display name across all conversations
          await Promise.all(
            contact.all_conversation_ids.map(convId => 
              chatApi.updateConversationContact(convId, contact.id, displayName.trim())
            )
          );
        }
        
        onUpdate();
        onClose();
      }
    } catch (error) {
      console.error('Error updating contact:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Contact</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Merged Conversations Info */}
        {'all_conversation_ids' in contact && contact.all_conversation_ids.length > 1 && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <div>
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                  This contact has {contact.all_conversation_ids.length} merged conversations
                </p>
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  Updates will apply to all conversations (WhatsApp, Broadcast, etc.)
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#128c7e] focus:border-[#128c7e] dark:bg-gray-700 dark:text-white"
                placeholder="Enter contact name"
                required
              />
            </div>
          </div>

          {/* Phone Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone Number
            </label>
            <div className="flex gap-2">
              {/* Country Code Dropdown */}
              <div className="relative country-dropdown">
                <button
                  type="button"
                  onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#128c7e] focus:border-[#128c7e] dark:bg-gray-700 dark:text-white min-w-[120px]"
                  disabled={isSaving}
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
                value={phoneNumber}
                onChange={handlePhoneChange}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#128c7e] focus:border-[#128c7e] dark:bg-gray-700 dark:text-white"
                placeholder="12345 67890"
                maxLength={11} // 5 digits + space + 5 digits
                required
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 bg-[#128c7e] hover:bg-[#005c4b] disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Update Contact</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
