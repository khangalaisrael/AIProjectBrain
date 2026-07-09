"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { useAuthStore } from "@/lib/auth-store";

export default function AuthCallbackPage() {
  const router = useRouter();
  const setToken = useAuthStore((s) => s.setToken);
  const [error, setError] = useState(false);

  useEffect(() => {
    // The backend redirects here with `#token=<jwt>` in the URL fragment.
    const hash = window.location.hash.replace(/^#/, "");
    const token = new URLSearchParams(hash).get("token");

    if (token) {
      setToken(token);
      router.replace("/dashboard");
    } else {
      setError(true);
    }
  }, [router, setToken]);

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 text-sm">
      {error ? (
        <p className="text-muted-foreground">
          Sign-in failed. Please{" "}
          <a href="/repositories" className="text-accent underline">
            try again
          </a>
          .
        </p>
      ) : (
        <>
          <Loader2 className="text-muted-foreground size-6 animate-spin" />
          <p className="text-muted-foreground">Signing you in…</p>
        </>
      )}
    </div>
  );
}
