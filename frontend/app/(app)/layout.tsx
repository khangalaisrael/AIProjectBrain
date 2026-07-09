"use client";

import { useState } from "react";
import { motion } from "framer-motion";

import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/topnav";
import { ChatDock } from "@/components/chat/chat-dock";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar collapsed={collapsed} />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav onToggleSidebar={() => setCollapsed((value) => !value)} />

        <main className="flex-1 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="mx-auto w-full max-w-[1400px] px-6 py-8"
          >
            {children}
          </motion.div>
        </main>
      </div>

      <ChatDock />
    </div>
  );
}
