'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser, UserButton } from '@clerk/nextjs';
import {
  ShoppingBag, Package, BarChart2, Bot, MessageSquare, AlertTriangle,
  TrendingUp, Skull, IndianRupee, Command as CommandIcon, Search,
  ChevronLeft, Zap, CircleDot, Network,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

const NAV_GROUPS: { group: string; items: NavItem[] }[] = [
  {
    group: 'Operations',
    items: [
      { label: 'Orders', href: '/orders', icon: <ShoppingBag size={16} /> },
      { label: 'Inventory', href: '/inventory', icon: <Package size={16} /> },
      { label: 'Dealer Network', href: '/network', icon: <Network size={16} />, badge: 'DEMO' },
    ],
  },
  {
    group: 'Intelligence',
    items: [
      { label: 'Analytics', href: '/analytics', icon: <BarChart2 size={16} /> },
      { label: 'Copilot', href: '/chatbot', icon: <Bot size={16} />, badge: 'AI' },
      { label: 'Forecasting', href: '/inventory/forecasting', icon: <TrendingUp size={16} /> },
    ],
  },
  {
    group: 'Supply Risk',
    items: [
      { label: 'Deadstock', href: '/inventory/deadstock', icon: <Skull size={16} /> },
      { label: 'Price Engine', href: '/inventory/priceAdj', icon: <IndianRupee size={16} /> },
    ],
  },
  {
    group: 'Trust & Voice',
    items: [
      { label: 'Errors', href: '/errors', icon: <AlertTriangle size={16} /> },
      { label: 'Feedback', href: '/feedback', icon: <MessageSquare size={16} /> },
    ],
  },
];

const PALETTE_ACTIONS = [
  ...NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.group }))),
  { label: 'Ask: which products are trending?', href: '/chatbot?q=Which%20products%20are%20trending%3F', icon: <Zap size={16} />, group: 'Copilot quick asks' },
  { label: 'Ask: what needs restocking?', href: '/chatbot?q=What%20needs%20restocking%3F', icon: <Zap size={16} />, group: 'Copilot quick asks' },
  { label: 'Ask: is demand growing?', href: '/chatbot?q=Is%20demand%20growing%20or%20shrinking%3F', icon: <Zap size={16} />, group: 'Copilot quick asks' },
];

function useCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const router = useRouter();

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return PALETTE_ACTIONS;
    return PALETTE_ACTIONS.filter((a) => a.label.toLowerCase().includes(q) || a.href.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQuery('');
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const run = useCallback(
    (href: string) => {
      setOpen(false);
      setQuery('');
      router.push(href);
    },
    [router]
  );

  return { open, setOpen, query, setQuery, activeIdx, setActiveIdx, results, run };
}

function CommandPalette({ palette }: { palette: ReturnType<typeof useCommandPalette> }) {
  const { open, setOpen, query, setQuery, activeIdx, setActiveIdx, results, run } = palette;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="fp-enter w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-4">
          <Search size={15} className="text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
              if (e.key === 'Enter' && results[activeIdx]) run(results[activeIdx].href);
            }}
            placeholder="Search modules or ask the copilot…"
            className="w-full bg-transparent py-3.5 text-sm text-popover-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">No matches</p>
          )}
          {results.map((r, i) => {
            const showGroup = i === 0 || results[i - 1].group !== r.group;
            return (
              <div key={`${r.label}-${i}`}>
                {showGroup && (
                  <p className="label-xs px-3 pb-1 pt-2">{r.group}</p>
                )}
                <button
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => run(r.href)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm ${
                    i === activeIdx ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <span className="text-muted-foreground">{r.icon}</span>
                  {r.label}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Topbar({ collapsed, onOpenPalette }: { collapsed: boolean; onOpenPalette: () => void }) {
  const pathname = usePathname();

  const title = useMemo(() => {
    const all = NAV_GROUPS.flatMap((g) => g.items);
    const match = [...all]
      .sort((a, b) => b.href.length - a.href.length)
      .find((i) => pathname.startsWith(i.href));
    if (match) return match.label;
    if (pathname.includes('track-order')) return 'Order Tracking';
    return 'Overview';
  }, [pathname]);

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-background/80 px-5 backdrop-blur-md"
    >
        <button
          onClick={onOpenPalette}
          className="group flex h-9 min-w-[220px] items-center gap-2 rounded-md border border-border bg-card px-3 text-xs text-muted-foreground transition-colors hover:border-ring"
        >
          <Search size={13} />
          <span className="flex-1 text-left">Jump to…</span>
          <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
        </button>

        <h1 className={`text-sm font-semibold tracking-tight ${collapsed ? '' : 'hidden md:block'}`}>{title}</h1>

        <div className="ml-auto flex items-center gap-4">
          <span className="hidden items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground sm:flex">
            <CircleDot size={10} className="text-emerald-400 fp-live-dot" />
            Local inference · onnx-cpu
          </span>
          <UserButton afterSignOutUrl="/" />
        </div>
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const { user } = useUser();
  const palette = useCommandPalette();

  return (
    <div className="flex h-screen overflow-hidden w-full">
      <aside
        className={`flex h-full shrink-0 flex-col border-r border-border bg-card transition-all duration-200 ${
          collapsed ? 'w-[64px]' : 'w-[228px]'
        }`}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-indigo-600 text-[13px] font-bold text-white shadow-lg shadow-indigo-950/50">
            FP
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold leading-tight">Flow Pilot</p>
              <p className="truncate text-[10px] uppercase tracking-wider text-muted-foreground">DMS Console</p>
            </div>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2.5 py-4">
          {NAV_GROUPS.map(({ group, items }) => (
            <div key={group} className="mb-4">
              {!collapsed && <p className="label-xs mb-1.5 px-2">{group}</p>}
              {items.map((item) => {
                const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'));
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`relative mb-0.5 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] transition-colors ${
                      active
                        ? 'bg-primary/10 font-medium text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                  >
                    {active && (
                      <span className="absolute left-0 top-1/2 h-4 w-[2.5px] -translate-y-1/2 rounded-full bg-primary" />
                    )}
                    <span className={active ? 'text-primary' : ''}>{item.icon}</span>
                    {!collapsed && <span className="flex-1">{item.label}</span>}
                    {!collapsed && item.badge && (
                      <span className="rounded-full bg-violet-500/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-violet-300">
                        {item.badge}
                      </span>
                    )}
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-2.5">
          <div className={`flex items-center gap-2.5 rounded-md px-1.5 py-1.5 ${collapsed ? 'justify-center' : ''}`}>
            <UserButton afterSignOutUrl="/" />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{user?.firstName ?? 'Operator'}</p>
                <p className="truncate text-[10px] text-muted-foreground">{user?.emailAddresses?.[0]?.emailAddress ?? ''}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={() => setCollapsed(true)}
                className="rounded p-1 text-muted-foreground hover:bg-accent"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft size={15} />
              </button>
            )}
          </div>
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="mt-1 w-full rounded-md py-1.5 text-muted-foreground hover:bg-accent"
              aria-label="Expand sidebar"
            >
              <CommandIcon size={15} className="mx-auto" />
            </button>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar collapsed={collapsed} onOpenPalette={() => palette.setOpen(true)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      <CommandPalette palette={palette} />
    </div>
  );
}
