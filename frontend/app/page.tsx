"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Brain,
  FileCode2,
  Github,
  MessageSquare,
  Network,
  Sparkles,
} from "lucide-react";

import { useAuth } from "@/lib/hooks";
import { SignInButton } from "@/components/auth/auth-controls";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { buttonVariants } from "@/components/ui/button";

const FEATURES = [
  {
    icon: BookOpen,
    title: "A course from any repo",
    body: "Import a GitHub repository and get an ordered set of lessons that walk through how it is built, one concept at a time.",
  },
  {
    icon: FileCode2,
    title: "Code Explorer",
    body: "Browse the file tree, read highlighted code, and ask AI about the exact file you are looking at.",
  },
  {
    icon: Network,
    title: "Software Atlas",
    body: "See the architecture as an interactive map: modules, layers and how they connect, with details on tap.",
  },
  {
    icon: MessageSquare,
    title: "Chat with the codebase",
    body: "Ask questions in plain English from any page. Answers are grounded in the repository you imported.",
  },
  {
    icon: Sparkles,
    title: "Overview & developer thinking",
    body: "Get a summary of the stack, size and difficulty, plus the reasoning behind the design choices.",
  },
  {
    icon: Brain,
    title: "Track your progress",
    body: "Mark lessons complete, pick up where you left off, and see how far through each course you are.",
  },
];

const STEPS = [
  { n: "1", title: "Sign in with GitHub", body: "One click. We only use it to find your repositories." },
  { n: "2", title: "Import a repository", body: "Choose any repo. It is indexed in the background." },
  { n: "3", title: "Start learning", body: "Follow the lessons, explore the code and ask questions." },
];

export default function Home() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // Signed-in visitors go straight to their dashboard.
  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
  }, [isAuthenticated, router]);

  return (
    <div className="bg-background text-foreground min-h-dvh">
      <header className="border-border/60 bg-background/80 sticky top-0 z-30 border-b backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="bg-accent text-accent-foreground flex size-7 items-center justify-center rounded-lg">
              <Brain className="size-4" />
            </span>
            <span className="hidden sm:inline">AI Project Brain</span>
            <span className="sm:hidden">Project Brain</span>
          </Link>
          <nav className="text-muted-foreground hidden items-center gap-6 text-sm md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SignInButton />
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[480px] opacity-60"
            style={{
              background:
                "radial-gradient(60% 60% at 50% 0%, color-mix(in srgb, var(--accent) 28%, transparent), transparent 70%)",
            }}
          />
          <div className="relative mx-auto max-w-4xl px-4 pt-16 pb-14 text-center sm:px-6 sm:pt-24 sm:pb-20">
            <span className="border-border bg-muted text-muted-foreground inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs">
              <Github className="size-3.5" /> Works with any GitHub repository
            </span>
            <h1 className="mt-5 text-4xl leading-tight font-semibold tracking-tight text-balance sm:text-6xl">
              Turn any codebase into a course you can{" "}
              <span className="text-accent">actually follow</span>
            </h1>
            <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base text-pretty sm:text-lg">
              Import a GitHub repository and learn how it works through guided lessons, an
              interactive architecture map and an AI that has read the code.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <SignInButton />
              <a
                href="#features"
                className={buttonVariants({ variant: "outline" })}
              >
                See what is inside <ArrowRight className="size-4" />
              </a>
            </div>
          </div>

          {/* Product sketch built from plain markup */}
          <div className="relative mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
            <div className="border-border bg-card overflow-hidden rounded-2xl border shadow-[var(--shadow-card-hover)]">
              <div className="border-border flex items-center gap-1.5 border-b px-4 py-3">
                <span className="size-2.5 rounded-full bg-red-400/80" />
                <span className="size-2.5 rounded-full bg-amber-400/80" />
                <span className="size-2.5 rounded-full bg-green-400/80" />
                <span className="text-muted-foreground ml-3 truncate text-xs">
                  Lesson 3 · How requests are routed
                </span>
              </div>
              <div className="grid md:grid-cols-[220px_1fr]">
                <ul className="border-border text-muted-foreground hidden space-y-1 border-r p-3 text-sm md:block">
                  {["Project structure", "Entry point", "How requests are routed", "Data layer", "Testing"].map(
                    (t, i) => (
                      <li
                        key={t}
                        className={
                          i === 2
                            ? "bg-accent/10 text-accent rounded-md px-3 py-2 font-medium"
                            : "px-3 py-2"
                        }
                      >
                        {t}
                      </li>
                    ),
                  )}
                </ul>
                <div className="space-y-4 p-5 text-left sm:p-6">
                  <p className="text-sm font-medium">How requests are routed</p>
                  <p className="text-muted-foreground text-sm">
                    Every request enters through a single router, which hands it to a service
                    and then to the data layer.
                  </p>
                  <pre className="bg-muted overflow-x-auto rounded-lg p-4 text-xs leading-relaxed">
{`@router.get("/repositories")
def list_repositories(user = Depends(get_current_user)):
    return service.list_for(user)`}
                  </pre>
                  <div className="border-border text-muted-foreground flex items-center gap-2 rounded-lg border px-3 py-2 text-xs">
                    <MessageSquare className="size-3.5" /> Ask about this file…
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-16 px-4 py-14 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">Everything you need to read code faster</h2>
            <p className="text-muted-foreground mt-3">
              Lessons, a map, an explorer and a chat, all tied to the repository you chose.
            </p>
          </div>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="border-border bg-card rounded-2xl border p-5 transition-shadow hover:shadow-[var(--shadow-card-hover)]"
              >
                <span className="bg-accent/10 text-accent flex size-9 items-center justify-center rounded-lg">
                  <Icon className="size-4.5" />
                </span>
                <h3 className="mt-4 font-medium">{title}</h3>
                <p className="text-muted-foreground mt-1.5 text-sm">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-border bg-muted/40 scroll-mt-16 border-y">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20">
            <h2 className="text-center text-3xl font-semibold tracking-tight">How it works</h2>
            <ol className="mt-10 grid gap-4 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="border-border bg-card rounded-2xl border p-5">
                  <span className="bg-accent text-accent-foreground flex size-8 items-center justify-center rounded-full text-sm font-semibold">
                    {s.n}
                  </span>
                  <h3 className="mt-4 font-medium">{s.title}</h3>
                  <p className="text-muted-foreground mt-1.5 text-sm">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Final CTA */}
        <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <h2 className="text-3xl font-semibold tracking-tight text-balance">
            Open your first repository
          </h2>
          <p className="text-muted-foreground mt-3">Sign in with GitHub to begin.</p>
          <div className="mt-7 flex justify-center">
            <SignInButton />
          </div>
        </section>
      </main>

      <footer className="border-border text-muted-foreground border-t py-6 text-center text-xs">
        AI Project Brain
      </footer>
    </div>
  );
}
