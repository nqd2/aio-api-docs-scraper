"use client";

import { ThemeToggle } from "./theme-toggle";
import Image from "next/image";

type Props = {
  onRefresh: () => void;
};

export function DashboardHeader({ onRefresh }: Props) {
  return (
    <header className="space-y-6">
      <nav className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3 shadow-sm backdrop-blur sm:px-5">
        <div className="flex min-w-0 items-center gap-3">

          <div className="min-w-0">
            <Image 
              src="/logo.png" 
              alt="API Docs Scraper Logo" 
              width={200} 
              height={200} 
              className="object-contain"
              priority 
            />
            <p className="truncate text-m text-muted-foreground">
              Scrape → Transform → Preview → Download
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center justify-center rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground shadow-sm transition hover:bg-muted sm:text-sm"
          >
            Refresh
          </button>
          <ThemeToggle />
        </div>
      </nav>
    </header>
  );
}

