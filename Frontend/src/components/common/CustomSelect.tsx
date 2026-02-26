import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  width?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  disabled = false,
  loading = false,
  className = '',
  width = 'w-40',
  size = 'md',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex(prev => 
            prev < options.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightedIndex >= 0 && !options[highlightedIndex].disabled) {
            onChange(options[highlightedIndex].value);
            setIsOpen(false);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, highlightedIndex, options, onChange]);

  // Scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && optionsRef.current) {
      const optionElements = optionsRef.current.children;
      if (optionElements[highlightedIndex]) {
        optionElements[highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Reset highlighted index when opening
  useEffect(() => {
    if (isOpen) {
      const selectedIndex = options.findIndex(opt => opt.value === value);
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    }
  }, [isOpen, options, value]);

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };

  if (loading) {
    return (
      <div className={`${width} h-10 bg-gray-100/80 dark:bg-[#1c1f29]/80 rounded-xl animate-pulse backdrop-blur-sm`} />
    );
  }

  return (
    <div ref={containerRef} className={`relative ${width} ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between
          ${sizeClasses[size]}
          bg-white/80 dark:bg-[#1c1f29]/80
          backdrop-blur-sm
          border border-gray-200/50 dark:border-gray-700/50
          rounded-xl
          text-gray-900 dark:text-white
          font-medium
          transition-all duration-200
          hover:bg-white dark:hover:bg-[#242a38]
          hover:shadow-md hover:shadow-black/5
          focus:outline-none focus:ring-2 focus:ring-[#128c7e]/40
          disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
          ${isOpen ? 'ring-2 ring-[#128c7e]/40 bg-white dark:bg-[#242a38]' : ''}
        `}
      >
        <span className={`truncate ${!selectedOption ? 'text-gray-400 dark:text-gray-500' : ''}`}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown 
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ml-2 ${
            isOpen ? 'rotate-180' : ''
          }`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className="
            absolute z-50 w-full mt-2
            bg-white/95 dark:bg-[#1c1f29]/95
            backdrop-blur-lg
            border border-gray-200/60 dark:border-gray-700/60
            rounded-xl
            shadow-xl shadow-black/10
            max-h-60 overflow-hidden
            animate-fade-in-down
          "
        >
          {/* Options List */}
          <div 
            ref={optionsRef}
            className="overflow-y-auto max-h-60 py-1 custom-scrollbar"
          >
            {options.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-400 dark:text-gray-500 text-center">
                No options available
              </div>
            ) : (
              options.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    if (!option.disabled) {
                      onChange(option.value);
                      setIsOpen(false);
                    }
                  }}
                  disabled={option.disabled}
                  className={`
                    w-full flex items-center justify-between
                    px-4 py-2.5
                    text-sm
                    transition-all duration-150
                    ${option.disabled 
                      ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                      : 'text-gray-700 dark:text-gray-300 hover:bg-[#128c7e]/10 dark:hover:bg-[#128c7e]/20 cursor-pointer'
                    }
                    ${value === option.value 
                      ? 'bg-[#128c7e]/10 dark:bg-[#128c7e]/20 text-[#128c7e] dark:text-[#128c7e]' 
                      : ''
                    }
                    ${highlightedIndex === index && !option.disabled
                      ? 'bg-gray-100 dark:bg-[#242a38]' 
                      : ''
                    }
                  `}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  <span className="truncate">{option.label}</span>
                  {value === option.value && (
                    <Check className="w-4 h-4 text-[#128c7e] flex-shrink-0 ml-2" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
