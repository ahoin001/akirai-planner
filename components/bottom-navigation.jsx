"use client";

import { Inbox, Calendar, Sparkles, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserProfileMenu } from "@/components/user-profile-menu";

const navItems = [
  //   { icon: Inbox, label: "Inbox", href: "#inbox" },
  { icon: Calendar, label: "Planner", href: "#Planner", active: true },
  //   { icon: Sparkles, label: "AI", href: "#ai" },
  // { icon: Settings, label: "Settings", href: "#settings" },
];

export function BottomNavigation() {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-[#1a1a1a] border-t border-gray-800 h-16 flex items-center justify-around px-4 z-[40]">
      {navItems.map((item) => (
        <a
          key={item.label}
          href={item.href}
          className={cn(
            "flex flex-col items-center justify-center",
            item.active ? "text-primary" : "text-gray-400"
          )}
        >
          <item.icon className="w-6 h-6" />
          <span className="text-xs mt-1">{item.label}</span>
        </a>
      ))}

      {/* User profile menu */}
      <div className="flex flex-col items-center justify-center py-4">
        <UserProfileMenu />
        <span className="text-xs mt-1 text-gray-400">Profile</span>
      </div>
    </div>
  );
}
