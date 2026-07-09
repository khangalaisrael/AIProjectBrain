import {
  BookOpen,
  Boxes,
  FileText,
  FolderGit2,
  LayoutDashboard,
  Lightbulb,
  Map,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Primary sidebar navigation (order matches the UI/UX specification). */
export const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Repositories", href: "/repositories", icon: FolderGit2 },
  { label: "Overview", href: "/overview", icon: Boxes },
  { label: "Learn", href: "/learn", icon: BookOpen },
  { label: "Code Explorer", href: "/code-explorer", icon: FileText },
  { label: "Atlas", href: "/atlas", icon: Map },
  { label: "Developer Thinking", href: "/developer-thinking", icon: Lightbulb },
  { label: "Documentation", href: "/documentation", icon: FileText },
  { label: "Settings", href: "/settings", icon: Settings },
];
