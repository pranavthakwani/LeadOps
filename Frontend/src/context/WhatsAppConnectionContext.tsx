import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import axios from 'axios';
import { io, Socket } from 'socket.io-client';

interface WhatsAppState {
  connected: boolean;
  qrRequired: boolean;
  qrCode: string | null;
  loading: boolean;
  error: string | null;
}

type WhatsAppAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_STATUS'; payload: { connected: boolean; qrRequired: boolean } }
  | { type: 'SET_QR_CODE'; payload: string }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };

const initialState: WhatsAppState = {
  connected: false,
  qrRequired: false,
  qrCode: null,
  loading: true,
  error: null,
};

function whatsAppReducer(state: WhatsAppState, action: WhatsAppAction): WhatsAppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_STATUS':
      return { 
        ...state, 
        connected: action.payload.connected, 
        qrRequired: action.payload.qrRequired,
        loading: false,
        error: null
      };
    case 'SET_QR_CODE':
      return { ...state, qrCode: action.payload, error: null };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

interface WhatsAppContextType {
  state: WhatsAppState;
  clearError: () => void;
}

const WhatsAppContext = createContext<WhatsAppContextType | undefined>(undefined);

export const useWhatsAppConnection = () => {
  const context = useContext(WhatsAppContext);
  if (!context) {
    throw new Error('useWhatsAppConnection must be used within WhatsAppProvider');
  }
  return context;
};

interface WhatsAppProviderProps {
  children: ReactNode;
}

export const WhatsAppProvider: React.FC<WhatsAppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(whatsAppReducer, initialState);

  // Clear error function
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Poll WhatsApp status every 1 second and set up WebSocket for real-time updates
  useEffect(() => {
    const pollStatus = async () => {
      try {
        const response = await axios.get('/api/whatsapp-status');
        const { connected, qrRequired } = response.data;
        
        dispatch({ type: 'SET_STATUS', payload: { connected, qrRequired } });

        // If QR is required, fetch the QR code
        if (qrRequired) {
          try {
            const qrResponse = await axios.get('/api/whatsapp-qr');
            dispatch({ type: 'SET_QR_CODE', payload: qrResponse.data.qr });
          } catch (qrError) {
            console.error('Failed to fetch QR code:', qrError);
            dispatch({ type: 'SET_ERROR', payload: 'Failed to generate QR code' });
          }
        } else {
          // Clear QR code when not required
          dispatch({ type: 'SET_QR_CODE', payload: '' });
        }
      } catch (error) {
        console.error('Failed to fetch WhatsApp status:', error);
        // If status check fails, assume QR is required to show modal immediately
        dispatch({ type: 'SET_STATUS', payload: { connected: false, qrRequired: true } });
        dispatch({ type: 'SET_ERROR', payload: 'Connection lost - requiring re-authentication' });
      }
    };

    // Set up WebSocket connection for real-time updates
    let socket: Socket | null = null;
    try {
      socket = io();
      
      socket.on('whatsapp:status', (data) => {
        console.log('WhatsApp status update via WebSocket:', data);
        const { connected, qrRequired } = data;
        dispatch({ type: 'SET_STATUS', payload: { connected, qrRequired } });
        
        if (qrRequired) {
          // Fetch QR code immediately when WebSocket indicates QR is required
          axios.get('/api/whatsapp-qr')
            .then(response => {
              dispatch({ type: 'SET_QR_CODE', payload: response.data.qr });
            })
            .catch(qrError => {
              console.error('Failed to fetch QR code:', qrError);
              dispatch({ type: 'SET_ERROR', payload: 'Failed to generate QR code' });
            });
        } else {
          dispatch({ type: 'SET_QR_CODE', payload: '' });
        }
      });

      socket.on('whatsapp:qr', (data) => {
        console.log('QR code update via WebSocket:', data);
        dispatch({ type: 'SET_QR_CODE', payload: data.qr });
        dispatch({ type: 'SET_STATUS', payload: { connected: false, qrRequired: true } });
      });

      socket.on('whatsapp:logout', () => {
        console.log('WhatsApp logout via WebSocket - immediate QR required');
        dispatch({ type: 'SET_STATUS', payload: { connected: false, qrRequired: true } });
        dispatch({ type: 'SET_ERROR', payload: 'Session expired - requiring re-authentication' });
        // Immediately fetch QR code
        axios.get('/api/whatsapp-qr')
          .then(response => {
            dispatch({ type: 'SET_QR_CODE', payload: response.data.qr });
          })
          .catch(qrError => {
            console.error('Failed to fetch QR code after logout:', qrError);
            dispatch({ type: 'SET_ERROR', payload: 'Failed to generate QR code' });
          });
      });

      socket.on('whatsapp:disconnected', () => {
        console.log('WhatsApp disconnected via WebSocket');
        dispatch({ type: 'SET_STATUS', payload: { connected: false, qrRequired: true } });
        dispatch({ type: 'SET_ERROR', payload: 'WhatsApp disconnected - requiring re-authentication' });
      });

    } catch (error) {
      console.error('Failed to set up WebSocket connection:', error);
    }

    // Initial poll
    pollStatus();

    // Set up polling interval as fallback
    const interval = setInterval(pollStatus, 1000);

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const contextValue: WhatsAppContextType = {
    state,
    clearError,
  };

  return (
    <WhatsAppContext.Provider value={contextValue}>
      {children}
    </WhatsAppContext.Provider>
  );
};
