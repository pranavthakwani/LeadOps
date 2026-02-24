import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { getDashboardStats } from '../services/api';
import { Loader } from '../components/common/Loader';
import { BrandOfferingsCard } from '../components/common/BrandOfferingsCard';
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

          {/* Brand Offerings Card */}
          <div className="mb-8">
            <BrandOfferingsCard />
          </div>
        </>
      )}
    </div>
  );
};
