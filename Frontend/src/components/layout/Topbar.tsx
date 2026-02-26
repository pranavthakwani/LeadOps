import React, { useEffect, useState } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { getHealth } from '../../services/api';
import type { HealthStatus } from '../../types/message';

export const Topbar: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await getHealth();
        setHealth(data);
      } catch (error) {
        console.error('Failed to fetch health', error);
      }
    };

    fetchHealth();
    const interval = setInterval(fetchHealth, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <header className="h-16 bg-[var(--bg-surface)]/80 backdrop-blur-sm border-b border-[var(--border-soft)] flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-[var(--text-primary)] tracking-tight">Jay Jalaram Enterprise</h2>
      </div>

      <div className="flex items-center gap-6">
        {/* Connection Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--bg-elevated)]">
          {health?.whatsappConnected ? (
            <>
              <div className="status-dot status-dot-pulse" />
              <Wifi className="w-4 h-4 text-[var(--accent-primary)]" />
              <span className="text-sm font-medium text-[var(--text-secondary)]">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-4 h-4 text-red-500" />
              <span className="text-sm font-medium text-red-500">Disconnected</span>
            </>
          )}
        </div>

        <div className="h-5 w-px bg-[var(--border-soft)]"></div>

        {/* Date */}
        <div className="text-sm text-[var(--text-secondary)] font-medium">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          })}
        </div>
      </div>
    </header>
  );
};
