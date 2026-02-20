import React, { useState } from 'react';
import { X, Save, Phone, User } from 'lucide-react';
import { chatApi } from '../../services/chatApi';

interface EditContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  contact: {
    id: number;
    display_name: string;
    phone_number: string;
  };
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName.trim() || !phoneNumber.trim()) {
      return;
    }

    setIsSaving(true);
    
    try {
      const success = await chatApi.updateContact(contact.id, displayName.trim(), phoneNumber.trim());
      
      if (success) {
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
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#128c7e] focus:border-[#128c7e] dark:bg-gray-700 dark:text-white"
                placeholder="Enter phone number"
                required
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
