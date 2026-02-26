import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { getDashboardStats } from '../services/api';
import { Loader } from '../components/common/Loader';
import { BrandOfferingsCard } from '../components/common/BrandOfferingsCard';
import type { DashboardStats } from '../types/message';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
}

const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ value, duration = 600 }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    const startTime = Date.now();
    const startValue = displayValue;
    const endValue = value;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * easeProgress);
      
      setDisplayValue(current);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue}</span>;
};

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
      color: 'text-[var(--accent-primary)]',
      gradient: 'from-[var(--accent-primary)]/10 to-transparent',
      onClick: () => navigate('/inbox?tab=lead'),
    },
    {
      title: 'Offerings',
      value: stats?.offeringsToday || 0,
      icon: TrendingDown,
      color: 'text-blue-500',
      gradient: 'from-blue-500/10 to-transparent',
      onClick: () => navigate('/inbox?tab=offering'),
    },
    {
      title: 'Ignored',
      value: stats?.ignoredToday || 0,
      icon: X,
      color: 'text-[var(--text-tertiary)]',
      gradient: 'from-gray-500/10 to-transparent',
      onClick: () => navigate('/inbox?tab=ignored'),
    },
  ];

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-2 tracking-tight">
          Dashboard
        </h1>
        <p className="text-[var(--text-secondary)]">
          Today's activity overview
        </p>
      </div>

      {loading ? (
        <Loader type="dashboard" />
      ) : !stats ? (
        <div className="p-8 text-[var(--text-secondary)]">Failed to load dashboard</div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-3 gap-6 mb-8">
            {cards.map((card) => (
              <div
                key={card.title}
                onClick={card.onClick}
                className="bg-white/80 dark:bg-[#151821]/80 backdrop-blur-sm rounded-2xl p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all cursor-pointer border border-gray-200/50 dark:border-gray-700/50 relative overflow-hidden group"
              >
                {/* Subtle gradient overlay */}
                <div 
                  className={`absolute inset-0 bg-gradient-to-br ${card.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
                />
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <div 
                      className={`p-3 rounded-xl bg-gray-100/80 dark:bg-[#1c1f29]/80 backdrop-blur-sm ${card.color}`}
                    >
                      <card.icon className="w-6 h-6" />
                    </div>
                  </div>
                  <div>
                    <div className={`text-3xl font-semibold text-gray-900 dark:text-white mb-1`}>
                      <AnimatedNumber value={card.value} />
                    </div>
                    <div className={`text-sm font-medium text-gray-500 dark:text-gray-400`}>
                      {card.title}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Brand Offerings Card */}
          <div className="animate-slide-up">
            <BrandOfferingsCard />
          </div>
        </>
      )}
    </div>
  );
};
