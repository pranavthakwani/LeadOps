import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Inbox, Users, Settings, Search, Moon, Sun } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inbox', icon: Inbox, label: 'Inbox' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/settings', icon: Settings, label: 'Settings' },
  { to: '/search', icon: Search, label: 'Search' },
];

export const Sidebar: React.FC = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      <div className="p-6 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">JJE</h1>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">WhatsApp Trading System</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 font-medium border border-emerald-200 dark:border-emerald-800'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900/50'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>System Online</span>
          </div>
        </div>
        
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-900 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-4 h-4" />
              <span>Dark Mode</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4" />
              <span>Light Mode</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
