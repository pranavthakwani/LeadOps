import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface WhatsAppStatus {
  connected: boolean;
  qrRequired: boolean;
  lastConnected: string | null;
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'qr_required';
  lastDisconnectReason: number | null;
}

interface QRResponse {
  success: boolean;
  qr: string | null;
}

const WhatsAppConnection: React.FC = () => {
  const [status, setStatus] = useState<WhatsAppStatus>({
    connected: false,
    qrRequired: false,
    lastConnected: null,
    connectionState: 'disconnected',
    lastDisconnectReason: null
  });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Poll backend for status every 3 seconds
  useEffect(() => {
    const pollStatus = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const statusResponse = await fetch('/api/whatsapp-status');
        if (!statusResponse.ok) {
          throw new Error('Failed to fetch WhatsApp status');
        }
        
        const statusData: WhatsAppStatus = await statusResponse.json();
        setStatus(statusData);
        
        // If QR is required, fetch the QR code
        if (statusData.qrRequired) {
          const qrResponse = await fetch('/api/whatsapp-qr');
          if (!qrResponse.ok) {
            throw new Error('Failed to fetch QR code');
          }
          
          const qrData: QRResponse = await qrResponse.json();
          if (qrData.success && qrData.qr) {
            setQrCode(qrData.qr);
          } else {
            setQrCode(null);
          }
        } else {
          setQrCode(null);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error polling WhatsApp status:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    // Initial poll
    pollStatus();

    // Set up polling interval
    const interval = setInterval(pollStatus, 3000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = () => {
    switch (status.connectionState) {
      case 'connected':
        return 'text-green-600';
      case 'connecting':
        return 'text-yellow-600';
      case 'qr_required':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusText = () => {
    switch (status.connectionState) {
      case 'connected':
        return 'WhatsApp Connected';
      case 'connecting':
        return 'Connecting to WhatsApp...';
      case 'qr_required':
        return 'QR Code Required';
      default:
        return 'WhatsApp Disconnected';
    }
  };

  const getDisconnectReasonText = (reason: number | null) => {
    if (!reason) return '';
    
    const reasons: { [key: number]: string } = {
      401: 'Session expired - logged out',
      408: 'Connection timeout',
      415: 'Unsupported media type',
      500: 'Internal server error',
      515: 'Restart required'
    };
    
    return reasons[reason] || `Unknown error (${reason})`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading WhatsApp status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Connection Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-4">WhatsApp Connection</h2>
        
        {/* Status Display */}
        <div className={`text-lg font-medium mb-4 ${getStatusColor()}`}>
          {getStatusText()}
        </div>

        {/* Connected State */}
        {status.connected && (
          <div className="space-y-2">
            <div className="flex items-center justify-center">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="ml-2 text-green-600">Connected</span>
            </div>
            {status.lastConnected && (
              <p className="text-sm text-gray-500">
                Last connected: {new Date(status.lastConnected).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* QR Code Display */}
        {status.qrRequired && qrCode && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-800 mb-2">
                Scan this QR with WhatsApp to connect
              </h3>
              <div className="flex justify-center">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <QRCodeSVG 
                    value={qrCode} 
                    size={256} 
                    level="H"
                    includeMargin={true}
                  />
                </div>
              </div>
              <div className="mt-4 text-xs text-blue-700">
                <p>1. Open WhatsApp on your phone</p>
                <p>2. Go to Settings &gt; Linked Devices</p>
                <p>3. Tap "Link a Device"</p>
                <p>4. Point camera at the QR code</p>
              </div>
            </div>
          </div>
        )}

        {/* Connecting State */}
        {status.connectionState === 'connecting' && (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-600"></div>
              <span className="ml-2 text-yellow-600">Connecting...</span>
            </div>
            <p className="text-sm text-gray-500">
              Please wait while we establish a connection to WhatsApp.
            </p>
          </div>
        )}

        {/* Disconnected State */}
        {status.connectionState === 'disconnected' && !status.qrRequired && (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <span className="ml-2 text-gray-600">Disconnected</span>
            </div>
            {status.lastDisconnectReason && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  Last disconnect: {getDisconnectReasonText(status.lastDisconnectReason)}
                </p>
              </div>
            )}
            <p className="text-sm text-gray-500">
              Attempting to reconnect automatically...
            </p>
          </div>
        )}

        {/* Auto-refresh indicator */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            Status updates automatically every 3 seconds
          </p>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppConnection;
