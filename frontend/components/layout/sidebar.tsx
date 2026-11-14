"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain } from "lucide-react";

import { navItems } from "@/lib/nav";
import { cn } from "@/lib/utils";

interface SidebarProps {
  collapsed: boolean;
  /** Below lg the sidebar is an off-canvas drawer; this slides it in. */
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed, mobileOpen = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "border-border bg-sidebar flex h-full flex-col border-r transition-all duration-200",
        "fixed inset-y-0 left-0 z-50 w-64 max-w-[85vw] lg:static lg:z-auto lg:max-w-none",
        mobileOpen ? "translate-x-0 shadow-xl" : "-translate-x-full lg:translate-x-0",
        collapsed ? "lg:w-16" : "lg:w-60",
      )}
    >
      <div className="flex h-14 items-center gap-2 px-4">
        <Brain className="text-accent size-6 shrink-0" />
        <span className={cn("text-sm font-semibold", collapsed && "lg:hidden")}>Project Brain</span>
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
                "flex items-center gap-3 rounded-md px-3 py-3 text-sm transition-colors lg:py-2",
                active
                  ? "bg-muted text-foreground font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "lg:justify-center lg:px-0",
              )}
            >
              <Icon className="size-4 shrink-0" />
              <span className={cn("truncate", collapsed && "lg:hidden")}>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
