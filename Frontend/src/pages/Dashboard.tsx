import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { getDashboardStats } from '../services/api';
import { Loader } from '../components/common/Loader';
import { ClassificationBadge } from '../components/inbox/ClassificationBadge';
import type { DashboardStats } from '../types/message';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to fetch stats', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const cards = [
    {
      title: 'Leads',
      value: stats?.leadsToday || 0,
      icon: TrendingUp,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-950/50',
      borderColor: 'border-blue-200 dark:border-blue-800',
      onClick: () => navigate('/inbox?tab=lead'),
    },
    {
      title: 'Offerings',
      value: stats?.offeringsToday || 0,
      icon: TrendingDown,
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-950/50',
      borderColor: 'border-green-200 dark:border-green-800',
      onClick: () => navigate('/inbox?tab=offering'),
    },
    {
      title: 'Ignored',
      value: stats?.ignoredToday || 0,
      icon: X,
      color: 'text-gray-600 dark:text-gray-400',
      bgColor: 'bg-gray-50 dark:bg-gray-950/50',
      borderColor: 'border-gray-200 dark:border-gray-800',
      onClick: () => navigate('/inbox?tab=ignored'),
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Today's activity overview</p>
      </div>

      {loading ? (
        <Loader type="dashboard" />
      ) : !stats ? (
        <div className="p-8">Failed to load dashboard</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-6 mb-8">
            {cards.map((card) => (
              <div
                key={card.title}
                onClick={card.onClick}
                className={`bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 p-6 hover:shadow-lg hover:border-emerald-300 dark:hover:border-emerald-600 transition-all cursor-pointer ${card.borderColor}`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-lg ${card.bgColor}`}>
                    <card.icon className={`w-6 h-6 ${card.color}`} />
                  </div>
                </div>
                <div>
                  <div className={`text-2xl font-bold text-gray-900 dark:text-white mb-1`}>
                    {card.value}
                  </div>
                  <div className={`text-sm font-medium text-gray-600 dark:text-gray-400`}>
                    {card.title}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800">
            <div className="p-6 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Last 10 messages</p>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {stats.recentActivity.map((message) => (
                <div
                  key={message.id}
                  onClick={() => navigate(`/message/${message.id}`)}
                  className="p-4 hover:bg-gray-50 dark:hover:bg-gray-900/30 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-medium text-gray-900 dark:text-white">{message.sender}</span>
                        <ClassificationBadge classification={message.classification} />
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{message.preview}</p>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(message.timestamp).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
