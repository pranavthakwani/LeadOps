/**
 * Centralized Network Configuration
 * This file controls ALL API and Socket endpoints.
 * Never hardcode localhost anywhere else.
 */

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return '';
};

export const BASE_URL = getBaseUrl();

// REST API base
export const API_BASE_URL = `${BASE_URL}/api`;

// Socket base
export const SOCKET_BASE_URL = BASE_URL;
