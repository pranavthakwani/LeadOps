import React, { useEffect, useState } from 'react';
import { XCircle, Activity, Server, Clock, Code } from 'lucide-react';
import { getHealth } from '../services/api';
import { Loader } from '../components/common/Loader';
import { useWhatsAppConnection } from '../context/WhatsAppConnectionContext';
import type { HealthStatus } from '../types/message';

export const Settings: React.FC = () => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { state: whatsappState } = useWhatsAppConnection();

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
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2 tracking-tight">
          Settings
        </h1>
        <p className="text-[var(--text-secondary)]">
          System configuration and status
        </p>
      </div>

      {loading ? (
        <Loader type="settings" />
      ) : !health ? (
        <div className="text-center text-red-500">Failed to load system health</div>
      ) : (
        <div className="space-y-6">
          {/* System Health Card */}
          <div className="bg-white/80 dark:bg-[#151821]/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-200/50 dark:border-gray-700/50 animate-fade-in">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
              <div className="p-2 bg-[#128c7e]/10 rounded-xl backdrop-blur-sm">
                <Activity className="w-5 h-5 text-[#128c7e]" />
              </div>
              System Health
            </h2>

            <div className="space-y-1">
              {/* Backend Status */}
              <div className="flex items-center justify-between py-4 px-4 rounded-[var(--radius-md)] hover:bg-[var(--bg-elevated)] transition-colors group">
                <div className="flex items-center gap-3">
                  <Server className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">Backend Status</div>
                    <div className="text-xs text-[var(--text-tertiary)]">API and core services</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {health.status === 'healthy' ? (
                    <>
                      <div className="status-dot status-dot-pulse" />
                      <span className="text-sm font-medium text-[var(--accent-primary)]">Healthy</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-500" />
                      <span className="text-sm font-medium text-red-500">
                        {health.status === 'degraded' ? 'Degraded' : 'Down'}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* WhatsApp Connection */}
              <div className="flex items-center justify-between py-4 px-4 rounded-[var(--radius-md)] hover:bg-[var(--bg-elevated)] transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <span className="text-[var(--text-tertiary)] text-xs">WA</span>
                  </div>
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">WhatsApp Connection</div>
                    <div className="text-xs text-[var(--text-tertiary)]">Message ingestion status</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {health.whatsappConnected ? (
                    <>
                      <div className="status-dot status-dot-pulse" />
                      <span className="text-sm font-medium text-[var(--accent-primary)]">Connected</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-5 h-5 text-red-500" />
                      <span className="text-sm font-medium text-red-500">Disconnected</span>
                    </>
                  )}
                </div>
              </div>

              {/* Backend Version */}
              <div className="flex items-center justify-between py-4 px-4 rounded-[var(--radius-md)] hover:bg-[var(--bg-elevated)] transition-colors group">
                <div className="flex items-center gap-3">
                  <Code className="w-4 h-4 text-[var(--text-tertiary)]" />
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">Backend Version</div>
                    <div className="text-xs text-[var(--text-tertiary)]">Current deployment</div>
                  </div>
                </div>
                <div className="text-sm font-mono text-[var(--text-secondary)] bg-[var(--bg-elevated)] px-3 py-1 rounded-[var(--radius-sm)]">
                  {health.backendVersion}
                </div>
              </div>
            </div>
          </div>

          {/* WhatsApp Connection Card */}
          <div className="bg-white/80 dark:bg-[#151821]/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-200/50 dark:border-gray-700/50 animate-fade-in" style={{ animationDelay: '200ms' }}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
              <div className="p-2 bg-[#128c7e]/10 rounded-xl backdrop-blur-sm">
                <span className="text-[var(--text-tertiary)] text-xs">WA</span>
              </div>
              WhatsApp Connection
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                <div className="flex items-center gap-2">
                  {whatsappState.connected ? (
                    <>
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium text-green-600">Connected</span>
                    </>
                  ) : whatsappState.qrRequired ? (
                    <>
                      <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                      <span className="text-sm font-medium text-yellow-600">QR Required</span>
                    </>
                  ) : (
                    <>
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-sm font-medium text-red-600">Disconnected</span>
                    </>
                  )}
                </div>
              </div>
              {whatsappState.qrRequired && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    WhatsApp authentication is required. A QR code modal will appear automatically.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Environment Information Card */}
          <div className="bg-white/80 dark:bg-[#151821]/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-gray-200/50 dark:border-gray-700/50 animate-fade-in" style={{ animationDelay: '100ms' }}>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5 flex items-center gap-2">
              <div className="p-2 bg-gray-100/80 dark:bg-[#1c1f29]/80 rounded-xl backdrop-blur-sm">
                <Clock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </div>
              Environment Information
            </h2>

            <div className="space-y-1">
              <div className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-white/60 dark:hover:bg-[#1c1f29]/60 transition-colors">
                <span className="text-sm text-gray-500 dark:text-gray-400">Environment</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white bg-white/70 dark:bg-[#1c1f29]/70 px-3 py-1 rounded-lg backdrop-blur-sm">
                  Production
                </span>
              </div>
              <div className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-white/60 dark:hover:bg-[#1c1f29]/60 transition-colors">
                <span className="text-sm text-gray-500 dark:text-gray-400">Frontend Version</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white bg-white/70 dark:bg-[#1c1f29]/70 px-3 py-1 rounded-lg backdrop-blur-sm">
                  1.0.0
                </span>
              </div>
              <div className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-white/60 dark:hover:bg-[#1c1f29]/60 transition-colors">
                <span className="text-sm text-gray-500 dark:text-gray-400">Last Updated</span>
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
