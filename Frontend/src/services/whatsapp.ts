export const openWhatsApp = (deepLink: string): void => {
  window.open(deepLink, '_blank', 'noopener,noreferrer');
};

export const formatPhoneNumber = (number: string): string => {
  if (number.startsWith('+91')) {
    return number.replace('+91', '+91 ');
  }
  return number;
};
