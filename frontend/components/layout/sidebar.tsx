"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain } from "lucide-react";

import { navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  /** Phones only: the sidebar is a drawer that slides over the page. */
  mobileOpen: boolean;
  onNavigate: () => void;
}

export function Sidebar({ collapsed: desktopCollapsed, mobileOpen, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  // The drawer is always full width; collapsing only applies on desktop.
  const collapsed = desktopCollapsed && !mobileOpen;

  return (
    <aside
      className={cn(
        "border-border bg-sidebar flex h-full flex-col border-r transition-all duration-200",
        "fixed inset-y-0 left-0 z-40 md:static md:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div className="flex h-14 items-center gap-2 px-4">
        <Brain className="text-accent size-6 shrink-0" />
        {!collapsed && <span className="text-sm font-semibold">Project Brain</span>}
      </div>

      <nav className="flex-1 space-y-1 px-2 py-2">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
