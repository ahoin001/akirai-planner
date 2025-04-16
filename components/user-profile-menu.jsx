"use client";

import { useAuthStore } from "@/app/stores/useAuthStore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { LogOut, Moon, Sun, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import Image from "next/image";
import { ThemeSwitcher } from "./theme-switcher";

export function UserProfileMenu() {
  const { user, signOut } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme(); // Use resolvedTheme for accurate current theme

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!user || !mounted) return null;

  // Get user initials or first letter of email
  const getInitials = () => {
    if (!user) return "?";

    if (user.user_metadata?.full_name) {
      return user.user_metadata.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase();
    }

    return user.email?.[0].toUpperCase() || "?";
  };

  const handleSignOut = async () => {
    const { success } = await signOut();
    if (success) {
      router.push("/sign-in");
      router.refresh(); // Ensure client cache is cleared
    }
  };
  console.log("User Profile Menu", user);
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        {user?.user_metadata?.picture ? (
          <Image
            src={user?.user_metadata?.picture}
            width={32}
            height={32}
            alt="Profile Picture"
            className="h-8 w-8 rounded-full object-cover hover:cursor-pointer"
          />
        ) : (
          <Button
            variant="ghost"
            className="relative rounded-full bg-rose-400 text-white"
          >
            {getInitials()}
          </Button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">
              {user.user_metadata?.full_name || "User"}
            </p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <User className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        {/* Theme Toggle Item */}
        <DropdownMenuItem
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="mr-2 h-4 w-4" />
          ) : (
            <Moon className="mr-2 h-4 w-4" />
          )}
          <span>{resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
