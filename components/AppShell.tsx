'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useUser, UserButton } from '@clerk/nextjs';
import {
  ShoppingBag, Package, BarChart2, Bot, MessageSquare, AlertTriangle,
  TrendingUp, Skull, IndianRupee, Search, Zap, Network, Ticket,
  Bell, ChevronDown, Rocket,
} from 'lucide-react';

const ACCENT = '#EC4699';

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
      { label: 'Orders', href: '/orders', icon: <ShoppingBag size={17} /> },
      { label: 'Inventory', href: '/inventory', icon: <Package size={17} /> },
      { label: 'Dealer Network', href: '/network', icon: <Network size={17} />, badge: 'DEMO' },
    ],
  },
  {
    group: 'Intelligence',
    items: [
      { label: 'Analytics', href: '/analytics', icon: <BarChart2 size={17} /> },
      { label: 'Copilot', href: '/chatbot', icon: <Bot size={17} />, badge: 'AI' },
      { label: 'Forecasting', href: '/inventory/forecasting', icon: <TrendingUp size={17} /> },
    ],
  },
  {
    group: 'Commercial',
    items: [
      { label: 'Promotions', href: '/promotions', icon: <Ticket size={17} />, badge: 'NEW' },
    ],
  },
  {
    group: 'Supply Risk',
    items: [
      { label: 'Deadstock', href: '/inventory/deadstock', icon: <Skull size={17} /> },
      { label: 'Price Engine', href: '/inventory/priceAdj', icon: <IndianRupee size={17} /> },
    ],
  },
  {
    group: 'Trust & Voice',
    items: [
      { label: 'Errors', href: '/errors', icon: <AlertTriangle size={17} /> },
      { label: 'Feedback', href: '/feedback', icon: <MessageSquare size={17} /> },
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
  }, [open ]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/70 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="fp-enter w-full max-w-xl overflow-hidden rounded-[20px] border border-white/10 bg-[#17171C] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4">
          <Search size={15} className="text-zinc-500" />
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
            className="w-full bg-transparent py-3.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <kbd className="rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500">ESC</kbd>
        </div>
        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-zinc-500">No matches</p>
          )}
          {results.map((r, i) => {
            const showGroup = i === 0 || results[i - 1].group !== r.group;
            return (
              <div key={`${r.label}-${i}`}>
                {showGroup && (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{r.group}</p>
                )}
                <button
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => run(r.href)}
                  className={`flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-left text-sm transition-colors ${
                    i === activeIdx ? 'bg-white text-black' : 'text-zinc-400 hover:text-zinc-100'
                  }`}
                >
                  <span>{r.icon}</span>
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

function Topbar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { user } = useUser();
  const [errorCount, setErrorCount] = useState<number | null>(null);
  const today = useMemo(
    () =>
      new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
    []
  );
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Operator';
  const displayEmail = user?.emailAddresses?.[0]?.emailAddress ?? 'operator@flowpilot.local';

  useEffect(() => {
    let cancelled = false;
    const fetchErrorCount = async () => {
      try {
        const res = await fetch('/api/errors?limit=1');
        if (!res.ok) return;
        const body = await res.json() as { pagination?: { totalCount?: number }; success?: boolean; data?: unknown[] };
        const count = body.pagination?.totalCount ?? (Array.isArray(body.data) ? body.data.length : 0);
        if (!cancelled) setErrorCount(typeof count === 'number' ? count : 0);
      } catch {
        if (!cancelled) setErrorCount(null);
      }
    };
    fetchErrorCount();
    return () => { cancelled = true; };
  }, []);

  return (
    <header className="flex items-center gap-3 px-6 pt-5">
      {/* User chip — like the reference profile block */}
      <button className="flex min-w-0 items-center gap-3 rounded-full pr-2 text-left">
        {user?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-white/10" />
        ) : (
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            style={{ background: ACCENT }}
          >
            {(displayName?.[0] ?? 'O').toUpperCase()}
          </span>
        )}
        <span className="hidden min-w-0 sm:block">
          <span className="block truncate text-[14px] font-semibold leading-tight text-zinc-100">{displayName}</span>
          <span className="block truncate text-[11px] leading-tight text-zinc-500">{displayEmail}</span>
        </span>
        <ChevronDown size={15} className="hidden text-zinc-500 sm:block" />
      </button>

      <div className="ml-auto flex items-center gap-2.5">
        {/* Search pill */}
        <button
          onClick={onOpenPalette}
          className="flex h-11 w-[210px] items-center gap-2 rounded-full border border-white/10 bg-[#222228] px-4 text-[13px] text-zinc-400 transition-colors hover:border-white/20 hover:text-zinc-200 md:w-[260px]"
        >
          <Search size={15} />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="rounded border border-white/10 px-1 font-mono text-[10px]">⌘K</kbd>
        </button>
        {/* Bell with count badge */}
        <button
          aria-label="Notifications"
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-[#222228] text-zinc-300 transition-colors hover:border-white/20"
        >
          <Bell size={17} />
          {typeof errorCount === 'number' && errorCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
              style={{ background: ACCENT }}
            >
              {errorCount > 99 ? '99+' : errorCount}
            </span>
          )}
        </button>
        <span className="hidden text-xs text-zinc-500 lg:block">{today}</span>
        <span
          aria-label={`Today, ${today}`}
          className="hidden h-11 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold text-black sm:flex"
        >
          Today, {today}
        </span>
      </div>

      {/* Keep Clerk session controls mounted for auth state */}
      <span className="hidden">
        <UserButton afterSignOutUrl="/" />
      </span>
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useUser();
  const palette = useCommandPalette();
  const operatorName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Operator';
  const operatorEmail = user?.emailAddresses?.[0]?.emailAddress ?? '';

  return (
    <div className="h-screen w-full overflow-hidden bg-[#08080A] p-2.5 sm:p-3">
      <div className="flex h-full w-full gap-2.5 sm:gap-3">
        {/* ── Sidebar (reference: dark rounded rail) ─────────────────── */}
        <aside className="flex w-[216px] shrink-0 flex-col rounded-[24px] bg-[#121217] p-3 lg:w-[232px]">
          {/* Brand */}
          <div className="flex items-center gap-2 px-2 pb-4 pt-1">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-xl text-[15px] font-black text-white"
              style={{ background: ACCENT }}
            >
              ⌁
            </span>
            <span className="text-[19px] font-semibold tracking-tight text-white">Flow-Pilot</span>
          </div>

          {/* Nav — pill rows like the reference */}
          <nav className="flex-1 space-y-4 overflow-y-auto px-1 py-1">
            {NAV_GROUPS.map(({ group, items }) => (
              <div key={group}>
                <p className="px-3 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
                  {group}
                </p>
                <div className="space-y-1">
                  {items.map((item) => {
                    const active =
                      pathname === item.href ||
                      (item.href !== '/' && pathname.startsWith(item.href + '/'));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`group flex items-center gap-3 rounded-full px-3.5 py-2.5 text-[13.5px] font-medium transition-all ${
                          active
                            ? 'bg-white text-black shadow-[0_8px_24px_-8px_rgba(255,255,255,0.4)]'
                            : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span className={active ? 'text-black' : 'text-zinc-500 group-hover:text-zinc-200'}>
                          {item.icon}
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge && (
                          <span
                            className={`rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${
                              active ? 'text-white' : 'text-white'
                            }`}
                            style={{ background: active ? ACCENT : `${ACCENT}33`, color: active ? '#fff' : ACCENT }}
                          >
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Upgrade card — reference lime card, here brand pink */}
          <div className="rounded-[20px] p-4 text-black" style={{ background: ACCENT }}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/15 text-black">
              <Rocket size={20} />
            </div>
            <p className="mt-3 text-[16px] font-bold leading-tight">Scale to Pro</p>
            <p className="mt-1 text-[11.5px] font-medium leading-snug text-black/70">
              Unlock forecasting, copilot and network analytics.
            </p>
            <Link
              href="/promotions"
              className="mt-3 flex h-10 items-center justify-center rounded-full bg-black text-[13px] font-semibold text-white transition-transform hover:scale-[1.02]"
            >
              Upgrade Now
            </Link>
          </div>

          {/* Operator row */}
          <div className="mt-2 flex items-center gap-2.5 rounded-full px-2 py-1.5">
            <UserButton afterSignOutUrl="/" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-zinc-100">{operatorName}</p>
              <p className="truncate text-[10px] text-zinc-500">{operatorEmail}</p>
            </div>
          </div>
        </aside>

        {/* ── Main panel (reference: light rounded sheet → here dark sheet) ── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#17171C]">
          <Topbar onOpenPalette={() => palette.setOpen(true)} />
          <main className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">{children}</main>
        </div>

        <CommandPalette palette={palette} />
      </div>
    </div>
  );
}
