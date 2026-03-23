/**
 * Phone number formatting utilities
 */

/**
 * Formats a phone number to the desired format: +91 93137 17527
 * @param phone - Phone number string (can be with or without country code)
 * @returns Formatted phone number
 */
export const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  
  // Remove all non-digit characters
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Handle different phone number lengths
  if (digitsOnly.length === 10) {
    // 10-digit number: assume India (+91)
    const countryCode = '+91';
    const firstFive = digitsOnly.slice(0, 5);
    const lastFive = digitsOnly.slice(5, 10);
    return `${countryCode} ${firstFive} ${lastFive}`;
  } else if (digitsOnly.length === 12) {
    // 12-digit number: assume first 2 are country code
    const countryCode = `+${digitsOnly.slice(0, 2)}`;
    const firstFive = digitsOnly.slice(2, 7);
    const lastFive = digitsOnly.slice(7, 12);
    return `${countryCode} ${firstFive} ${lastFive}`;
  } else if (digitsOnly.length >= 12) {
    // Longer numbers: take first 2-3 digits as country code, next 5 and remaining
    let countryCodeLength = 2;
    let countryCode = `+${digitsOnly.slice(0, countryCodeLength)}`;
    
    // Try 3-digit country code if 2-digit doesn't make sense
    if (digitsOnly.slice(0, 2) === '91' && digitsOnly.length > 12) {
      countryCodeLength = 3;
      countryCode = `+${digitsOnly.slice(0, countryCodeLength)}`;
    }
    
    const remainingDigits = digitsOnly.slice(countryCodeLength);
    const firstFive = remainingDigits.slice(0, 5);
    const lastFive = remainingDigits.slice(5, 10);
    
    return `${countryCode} ${firstFive} ${lastFive}`;
  }
  
  // If we can't format it properly, return as is
  return phone;
};

/**
 * Formats a phone number for display with fallback
 * @param phone - Phone number string
 * @param fallback - Fallback text if phone is empty
 * @returns Formatted phone number or fallback
 */
export const formatPhoneNumberDisplay = (phone: string, fallback: string = 'Unknown'): string => {
  if (!phone) return fallback;
  return formatPhoneNumber(phone);
};
