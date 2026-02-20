import React, { useState, useEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { countryCodes, getDefaultCountry, createWhatsAppJid, type CountryCode } from '../../data/countryCodes';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  submitButtonText: string;
  onSubmit: (name: string, jid: string) => Promise<void>;
  initialName?: string;
  initialPhone?: string;
  isSubmitting?: boolean;
}

export const ContactModal: React.FC<ContactModalProps> = ({
  isOpen,
  onClose,
  title,
  submitButtonText,
  onSubmit,
  initialName = '',
  initialPhone = '',
  isSubmitting = false
}) => {
  const [contactName, setContactName] = useState(initialName);
  const [contactPhone, setContactPhone] = useState(initialPhone);
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>(getDefaultCountry());
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  // Reset form when modal opens with new initial values
  useEffect(() => {
    if (isOpen) {
      setContactName(initialName);
      setContactPhone(initialPhone);
      setSelectedCountry(getDefaultCountry());
      setShowCountryDropdown(false);
    }
  }, [isOpen, initialName, initialPhone]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contactName.trim() || !contactPhone.trim()) return;

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
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[420px] max-w-[90vw] mx-4">
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
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
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
          </div>
          
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
              
              {/* Phone Number Input */}
              <input
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#128c7e] focus:border-[#128c7e] dark:bg-gray-700 dark:text-white"
                placeholder="Enter phone number"
                required
                disabled={isSubmitting}
              />
            </div>
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
              disabled={!contactName.trim() || !contactPhone.trim() || isSubmitting}
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
