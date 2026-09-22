import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { useCommandPalette } from '../context/CommandPaletteContext';
import Sidebar from './layout/Sidebar';
import Topbar from './layout/Topbar';

// Shared authenticated shell: sidebar navigation + topbar + page content.
export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { openPalette } = useCommandPalette();

  return (
    <div className="min-h-screen flex" style={{ background: 'transparent' }}>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar onMenu={() => setSidebarOpen(true)} onSearch={openPalette} />
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}