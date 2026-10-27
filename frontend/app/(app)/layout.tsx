"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/topnav";
import { ChatDock } from "@/components/chat/chat-dock";
import { CommandPalette } from "@/components/command-palette";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleSidebar = () => {
    if (window.matchMedia("(min-width: 768px)").matches) setCollapsed((value) => !value);
    else setMobileOpen((value) => !value);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav onToggleSidebar={toggleSidebar} />

        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8"
          >
            {children}
          </motion.div>
        </main>
      </div>

      <ChatDock />
      <CommandPalette />
    </div>
  );
}
