import React, { useState, useRef, useEffect, memo } from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Inbox, Settings, Moon, Sun, Search, Users } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/inbox', icon: Inbox, label: 'Inbox' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export const Sidebar: React.FC = memo(() => {
  const { theme, toggleTheme } = useTheme();
  const [sidebarWidth, setSidebarWidth] = useState(220);
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      
      const newWidth = e.clientX;
      const maxWidth = window.innerWidth / 2;
      const minWidth = 220;
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  return (
    <aside 
      ref={sidebarRef}
      style={{ width: `${sidebarWidth}px` }}
      className="sidebar flex flex-col relative z-20"
    >
      {/* Header */}
      <div className="p-6 border-b border-[var(--border-soft)]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <img 
              src="/assets/JJEfav.png" 
              alt="JJE Logo"
              className="w-14 h-14 object-contain rounded-[var(--radius-md)] elevation-sm"
            />
          </div>
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">
            Lead Ops
          </h1>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-[var(--radius-md)] transition-all duration-[180ms] cubic-bezier(0.4,0,0.2,1) ${
                isActive
                  ? 'sidebar-item active'
                  : 'sidebar-item'
              }`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span className="flex-1 text-sm font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[var(--border-soft)] space-y-4">
        {/* Status */}
        <div className="flex items-center gap-3 px-3">
          <div className="status-dot status-dot-pulse"></div>
          <span className="text-xs font-medium text-[var(--text-secondary)]">
            System Online
          </span>
        </div>
        
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-surface)] rounded-[var(--radius-md)] transition-all duration-[180ms] border border-[var(--border-subtle)] elevation-sm hover:elevation-md active:scale-[0.97]"
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

      {/* Resize Handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize group"
        onMouseDown={handleMouseDown}
        style={{ cursor: isResizing ? 'col-resize' : 'col-resize' }}
      >
        <div className="absolute inset-0 bg-transparent group-hover:bg-[var(--accent-primary)]/20 transition-colors" />
        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-[var(--accent-primary)] opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
      </div>
    </aside>
  );
});
