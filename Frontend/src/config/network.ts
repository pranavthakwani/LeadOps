/**
 * Centralized Network Configuration
 * This file controls ALL API and Socket endpoints.
 * Never hardcode localhost anywhere else.
 */

const getBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    // Browser environment
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    const port = window.location.port;
    
    // Check for environment variable first (for production deployments)
    const apiBaseUrl = import.meta.env?.VITE_API_BASE_URL;
    if (apiBaseUrl) {
      return apiBaseUrl;
    }
    
    // In development (localhost/127.0.0.1), point to backend server
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      // If frontend is running on different port, assume backend is on 5100
      return `${protocol}//${hostname}:5100`;
    }
    
    // In production, use the same origin (frontend and backend on same server)
    return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
  }
  
  // Server-side rendering or build time
  // Return empty string - will be resolved at runtime
  return '';
};

export const BASE_URL = getBaseUrl();

// REST API base
export const API_BASE_URL = `${BASE_URL}/api`;

// Socket base - point to backend server
export const SOCKET_BASE_URL = BASE_URL;
