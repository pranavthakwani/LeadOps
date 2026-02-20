import React from 'react';
import type { Message } from '../../types/message';
import { formatISTDateTime } from '../../utils/timeUtils';

interface OfferingCardProps {
  message: Message;
  onClick?: () => void;
}

const getBrandLogo = (brand: string | undefined) => {
  if (!brand) return null;
  
  const brandLower = brand.toLowerCase();
  const brandMap: { [key: string]: string } = {
    'apple': '/assets/brands/apple.png',
    'samsung': '/assets/brands/Samsung.png',
    'oppo': '/assets/brands/oppo.png',
    'vivo': '/assets/brands/vivo.png',
    'realme': '/assets/brands/realme.png',
    'oneplus': '/assets/brands/one plus.png',
    'iqoo': '/assets/brands/iqoo.jpeg', // Using vivo as placeholder
    'redmi': '/assets/brands/redmi.webp',
    'xiaomi': '/assets/brands/xiaomi.png',
    'motorola': '/assets/brands/moto.png',
    'moto': '/assets/brands/moto.png',
    'acer': '/assets/brands/noting.avif', // Placeholder
    'lenovo': '/assets/brands/noting.avif', // Placeholder
    'nokia': '/assets/brands/nokia.png', // Placeholder
    'asus': '/assets/brands/noting.avif', // Placeholder
    'huawei': '/assets/brands/noting.avif', // Placeholder
    'poco': '/assets/brands/poco.png',
    'infinix': '/assets/brands/Infinix.png',
    'tecno': '/assets/brands/tecno.png',
    'itel': '/assets/brands/itel.png',
    'lava': '/assets/brands/lava.png',
    'micromax': '/assets/brands/Micromax.jpg',
    'google': '/assets/brands/google.png',
    'narzo': '/assets/brands/narzo.png',
    'meta':'/assets/brands/meta.png'
  };
  
  return brandMap[brandLower] || null;
};

export const OfferingCard: React.FC<OfferingCardProps> = ({ message, onClick }) => {
  const getColorDisplay = (color: string | Record<string, number> | undefined) => {
    if (!color) return null;
    
    if (typeof color === 'string') {
      return { name: color, value: color };
    }
    
    const colorKeys = Object.keys(color);
    if (colorKeys.length > 0) {
      const colorName = colorKeys[0];
      return { name: colorName, value: colorName };
    }
    
    return null;
  };

  const colorDisplay = getColorDisplay(message.parsedData?.color);
  const brandLogo = getBrandLogo(message.parsedData?.brand);

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-600 transition-all cursor-pointer"
    >
      <div className="flex items-center gap-6 pr-3">
        {/* Brand Logo */}
        <div className="flex-shrink-0">
          {brandLogo ? (
            <img 
              src={brandLogo} 
              alt={message.parsedData?.brand || 'Brand'}
              className="w-16 h-16 object-contain rounded-lg bg-white dark:bg-gray-900 p-1"
              onError={(e) => {
                // Fallback to brand initial if image fails
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : (
            <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg flex items-center justify-center">
              <span className="text-emerald-700 dark:text-emerald-400 font-bold text-xl">
                {message.parsedData?.brand?.charAt(0) || 'P'}
              </span>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {message.parsedData?.brand && (
              <span className="font-semibold text-sm text-gray-900 dark:text-white">
                {message.parsedData.brand}
              </span>
            )}
            {message.parsedData?.model && (
              <span className="text-gray-600 dark:text-gray-400 text-sm">
                {message.parsedData.model}
              </span>
            )}
          </div>
          
          {/* RAM/ROM */}
          {(message.parsedData?.ram || message.parsedData?.storage) && (
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {message.parsedData?.ram && <span>{message.parsedData.ram}</span>}
              {message.parsedData?.ram && message.parsedData?.storage && <span> / </span>}
              {message.parsedData?.storage && <span>{message.parsedData.storage}</span>}
            </div>
          )}

          {/* Additional Details */}
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
            {colorDisplay && (
              <span>Color: {colorDisplay.name}</span>
            )}
            {message.parsedData?.gst && (
              <span>GST: {message.parsedData.gst}</span>
            )}
          </div>
        </div>

        {/* Price + Quantity */}
        <div className="flex-shrink-0 text-right mr-2">
          <div className="flex items-baseline justify-end gap-2 text-lg font-bold text-emerald-600 dark:text-emerald-400">
            
            {message.parsedData?.quantity && (
              <>
                <span className="text-sm text-gray-800 dark:text-gray-800">
                  {message.parsedData.quantity}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  units
                </span>
              </>
            )}

            {message.parsedData?.price && (
              <span>
                <span className="text-sm text-gray-500 dark:text-gray-400">@</span>
                ₹{message.parsedData.price.toLocaleString('en-IN')}
                <span className="text-xs text-gray-500 dark:text-gray-400">/-</span>
              </span>
            )}
          </div>
          
          {/* Date */}
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
            {formatISTDateTime(message.timestamp)}
          </div>
        </div>
      </div>

      {/* Sender Info */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span className="font-medium">{message.sender}</span>
          <span>•</span>
          <span>{message.senderNumber}</span>
        </div>
        
        {/* Classification Badge - Moved to left side */}
        <div className="flex items-center gap-2">
          {message.detectedBrands.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-medium border border-emerald-200 dark:border-emerald-800">
              {message.detectedBrands.join(', ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
