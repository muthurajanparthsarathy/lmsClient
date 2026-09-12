'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { flatNav } from './nav';

// Lightweight command palette (⌘K / Ctrl+K) — jump to any module without
// touching the mouse. Addresses the "no global search" audit finding using
// only existing dependencies (Dialog + plain filtering), no new packages.
export default function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (open) { setQuery(''); setActiveIndex(0); }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flatNav;
    return flatNav.filter((item) => item.label.toLowerCase().includes(q));
  }, [query]);

  // Close the dialog FIRST and let Radix finish its unmount/cleanup (which
  // restores `pointer-events` on <body>) before starting the route
  // transition. Doing both in the same tick races Radix's cleanup against
  // Next's navigation and can leave the page stuck with pointer-events:none.
  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[activeIndex]) { go(results[activeIndex].href); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">Search and jump to any module</DialogDescription>
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a module..."
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">No matches</div>
          ) : (
            results.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  onClick={() => go(item.href)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`sa-transition flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm ${
                    i === activeIndex ? 'bg-accent text-accent-foreground' : 'text-foreground'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {item.label}
                  </span>
                  {i === activeIndex && <CornerDownLeft className="h-3.5 w-3.5 text-muted-foreground" />}
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
