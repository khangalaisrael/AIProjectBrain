"use client";

import Image from "next/image";
import { Github, LogOut } from "lucide-react";

import { GITHUB_LOGIN_URL } from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { Button } from "@/components/ui/button";

/** Full-page navigation to the backend, which starts the GitHub OAuth flow. */
export function signInWithGitHub() {
  window.location.href = GITHUB_LOGIN_URL;
}

export function SignInButton() {
  return (
    <Button onClick={signInWithGitHub}>
      <Github className="size-4" />
      Sign in with GitHub
    </Button>
  );
}

export function AuthControls() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();

  if (isLoading) {
    return <div className="bg-muted size-8 animate-pulse rounded-full" />;
  }

  if (!isAuthenticated) {
    return <SignInButton />;
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        {user?.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt={user.username}
            width={28}
            height={28}
            className="rounded-full"
            unoptimized
          />
        ) : (
          <div className="bg-muted flex size-7 items-center justify-center rounded-full text-xs">
            {user?.username?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <span className="hidden text-sm font-medium sm:inline">{user?.username}</span>
      </div>
      <Button variant="ghost" size="icon" onClick={logout} aria-label="Sign out">
        <LogOut className="size-4" />
      </Button>
    </div>
  );
}
