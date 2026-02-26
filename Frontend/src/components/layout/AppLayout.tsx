import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const AppLayout: React.FC = () => {
  return (
    <div className="flex h-screen bg-[var(--bg-base)] gpu-accelerated">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
