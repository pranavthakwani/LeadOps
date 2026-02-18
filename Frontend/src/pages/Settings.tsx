import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Activity } from 'lucide-react';
import { getHealth } from '../services/api';
import { Loader } from '../components/common/Loader';
import type { HealthStatus } from '../types/message';

export const Settings: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await getHealth();
        setHealth(data);
      } catch (error) {
        console.error('Failed to fetch health', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, []);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400">System configuration and status</p>
      </div>

      {loading ? (
        <Loader type="settings" />
      ) : !health ? (
        <div className="text-center text-red-600">Failed to load system health</div>
      ) : (
        <div className="space-y-6 max-w-4xl">
          <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              System Health
            </h2>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Backend Status</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">API and core services</div>
                </div>
                <div className="flex items-center gap-2">
                  {health.status === 'healthy' ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">Healthy</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="text-sm font-medium text-red-700 dark:text-red-400">
                        {health.status === 'degraded' ? 'Degraded' : 'Down'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">WhatsApp Connection</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Message ingestion status</div>
                </div>
                <div className="flex items-center gap-2">
                  {health.whatsappConnected ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-700 dark:text-green-400">Connected</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-600" />
                      <span className="text-sm font-medium text-red-700 dark:text-red-400">Disconnected</span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between py-3">
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">Backend Version</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Current deployment</div>
                </div>
                <div className="text-sm font-mono text-gray-700 dark:text-gray-300">{health.backendVersion}</div>
              </div>
            </div>
          </div>

          
          <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Environment Information</h2>

            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm text-gray-600 dark:text-gray-400">Environment</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">Production</span>
              </div>
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                <span className="text-sm text-gray-600 dark:text-gray-400">Frontend Version</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">1.0.0</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Last Updated</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {new Date().toLocaleDateString('en-IN')}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
