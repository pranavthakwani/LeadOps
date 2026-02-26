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
    'iqoo': '/assets/brands/iqoo.jpeg',
    'redmi': '/assets/brands/redmi.webp',
    'xiaomi': '/assets/brands/xiaomi.png',
    'motorola': '/assets/brands/moto.png',
    'moto': '/assets/brands/moto.png',
    'acer': '/assets/brands/noting.avif',
    'lenovo': '/assets/brands/noting.avif',
    'nokia': '/assets/brands/nokia.png',
    'asus': '/assets/brands/noting.avif',
    'huawei': '/assets/brands/noting.avif',
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
      className="bg-white/80 dark:bg-[#151821]/80 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 rounded-xl p-4 hover:shadow-lg hover:border-emerald-300/50 dark:hover:border-emerald-600/50 transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-5">
        {/* Brand Logo */}
        <div className="flex-shrink-0">
          {brandLogo ? (
            <img 
              src={brandLogo} 
              alt={message.parsedData?.brand || 'Brand'}
              className="w-14 h-14 object-contain rounded-[var(--radius-md)] bg-[var(--bg-elevated)] p-2 elevation-sm"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
            />
          ) : (
            <div className="w-14 h-14 bg-[var(--accent-light)] rounded-[var(--radius-md)] flex items-center justify-center elevation-sm backdrop-blur-md">
              <span className="text-[var(--accent-primary)] font-bold text-xl">
                {message.parsedData?.brand?.charAt(0) || 'P'}
              </span>
            </div>
          )}
        </div>

        {/* Product Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {message.parsedData?.brand && (
              <span className="font-semibold text-sm text-[var(--text-primary)]">
                {message.parsedData.brand}
              </span>
            )}
            {message.parsedData?.model && (
              <span className="text-[var(--text-secondary)] text-sm">
                {message.parsedData.model}
              </span>
            )}
          </div>
          
          {/* RAM/ROM */}
          {(message.parsedData?.ram || message.parsedData?.storage) && (
            <div className="text-xs text-[var(--text-tertiary)]">
              {message.parsedData?.ram && <span>{message.parsedData.ram}</span>}
              {message.parsedData?.ram && message.parsedData?.storage && <span> / </span>}
              {message.parsedData?.storage && <span>{message.parsedData.storage}</span>}
            </div>
          )}

          {/* Additional Details */}
          <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] mt-1">
            {colorDisplay && (
              <span>Color: {colorDisplay.name}</span>
            )}
            {message.parsedData?.gst && (
              <span>GST: {message.parsedData.gst}</span>
            )}
          </div>
        </div>

        {/* Price + Quantity */}
        <div className="flex-shrink-0 text-right">
          <div className="flex items-baseline justify-end gap-2 text-lg font-semibold text-[var(--accent-primary)]">
            
            {message.parsedData?.quantity && (
              <>
                <span className="text-sm text-[var(--text-primary)]">
                  {message.parsedData.quantity}
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  units
                </span>
              </>
            )}

            {message.parsedData?.price && (
              <span>
                <span className="text-sm text-[var(--text-tertiary)]">@</span>
                ₹{message.parsedData.price.toLocaleString('en-IN')}
                <span className="text-xs text-[var(--text-tertiary)]">/-</span>
              </span>
            )}
          </div>
          
          {/* Date */}
          <div className="text-xs text-[var(--text-tertiary)] mt-1 text-right">
            {formatISTDateTime(message.timestamp)}
          </div>
        </div>
      </div>

      {/* Sender Info */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 text-xs text-[var(--text-tertiary)]">
          <span className="font-medium text-[var(--text-secondary)]">{message.sender}</span>
          <span>•</span>
          <span>{message.senderNumber}</span>
        </div>
        
        {/* Classification Badge */}
        <div className="flex items-center gap-2">
          {message.detectedBrands.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-[var(--accent-light)] text-[var(--accent-primary)] rounded-full text-xs font-medium">
              {message.detectedBrands.join(', ')}
            </span>
          )}
        </div>
      </div>

      {/* Hover border glow */}
      <div className="absolute inset-0 rounded-[var(--radius-lg)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none glow-soft" />
    </div>
  );
};
