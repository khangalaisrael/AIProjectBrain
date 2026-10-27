"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Github, Loader2, LogOut } from "lucide-react";

import { GITHUB_LOGIN_URL } from "@/lib/api";
import { useAuth } from "@/lib/hooks";
import { Button } from "@/components/ui/button";

/** Full-page navigation to the backend, which starts the GitHub OAuth flow. */
export function signInWithGitHub() {
  window.location.href = GITHUB_LOGIN_URL;
}

export function SignInButton() {
  const [pending, setPending] = useState(false);

  // Coming back via the browser's back button restores the page from cache,
  // spinner and all, so clear it.
  useEffect(() => {
    const reset = () => setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  return (
    <Button
      disabled={pending}
      onClick={() => {
        setPending(true);
        signInWithGitHub();
      }}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Github className="size-4" />}
      {pending ? "Signing in…" : "Sign in with GitHub"}
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
