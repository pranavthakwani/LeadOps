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
    <header className="h-16 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Trading Dashboard</h2>
      </div>

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          {health?.whatsappConnected ? (
            <>
              <Wifi className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Disconnected</span>
            </>
          )}
        </div>

        <div className="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>

        <div className="text-sm text-gray-600 dark:text-gray-400">
          {new Date().toLocaleDateString('en-IN', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </div>
      </div>
    </header>
  );
};
