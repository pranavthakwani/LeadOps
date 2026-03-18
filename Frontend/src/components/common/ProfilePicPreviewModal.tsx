import React from 'react';

interface ProfilePicPreviewModalProps {
  isOpen: boolean;
  imageUrl: string | null;
  contactName: string;
  onClose: () => void;
}

export const ProfilePicPreviewModal: React.FC<ProfilePicPreviewModalProps> = ({
  isOpen,
  imageUrl,
  contactName,
  onClose
}) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="relative max-w-lg max-h-[90vh] p-4">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-white/30 transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        {/* Profile picture */}
        <div className="relative">
          <img
            src={imageUrl}
            alt={contactName}
            className="w-full h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          
          {/* Contact name at bottom */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 rounded-b-lg">
            <p className="text-white text-center font-medium">{contactName}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
