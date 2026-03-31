// Helper function to get first letter for profile pic placeholder (skips tilde)
export const getFirstLetterForAvatar = (name: string) => {
  if (!name) return '?';
  
  // If name starts with ~, skip it and get the first actual letter
  if (name.startsWith('~')) {
    const nameWithoutTilde = name.substring(1);
    return nameWithoutTilde.charAt(0).toUpperCase() || '?';
  }
  
  return name.charAt(0).toUpperCase() || '?';
};
