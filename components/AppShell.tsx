'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useUser, UserButton } from '@clerk/nextjs';
import {
  ShoppingBag, Package, BarChart2, Bot, MessageSquare, AlertTriangle,
  TrendingUp, Skull, IndianRupee, Command as CommandIcon, Search,
  ChevronLeft, Zap, CircleDot, Network, Ticket, Menu, X, Rocket, Mail, Bell,
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
      { label: 'Email Drafts', href: '/email-drafts', icon: <Mail size={17} /> },
      { label: 'Email Reviews', href: '/email-reviews', icon: <Mail size={17} /> },
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

// Both overlays share keyboard containment and return focus to their opener.
function useModalFocus(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const root = ref.current;
    if (!root) return;
    const focusable = () => Array.from(root.querySelectorAll<HTMLElement>(
      'a[href], button, input, [tabindex="0"]'
    )).filter((element) => !element.hasAttribute('disabled'));
    (focusable()[0] ?? root).focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close(); }
      if (event.key === 'Tab') {
        const items = focusable();
        const first = items[0];
        const last = items[items.length - 1];
        if (!first) { event.preventDefault(); root.focus(); return; }
        if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('keydown', handler);
      if (opener?.isConnected) opener.focus();
    };
  }, [open, ref, close]);
}

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
        if (e.target instanceof Element && e.target.closest('#shell-navigation[role="dialog"]')) return;
        setOpen((o) => !o);
        setQuery('');
        setActiveIdx(0);
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), [setOpen]);
  useModalFocus(open, dialogRef, close);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-3 pt-[12vh] backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="fp-enter w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-white/10 px-4">
          <Search size={15} className="text-zinc-500" />
          <input
            ref={inputRef}
            role="combobox"
            aria-label="Search commands"
            aria-expanded="true"
            aria-controls="command-results"
            aria-activedescendant={results[activeIdx] ? `command-${activeIdx}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.max(0, Math.min(i + 1, results.length - 1))); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)); }
              if (e.key === 'Enter' && results[activeIdx]) run(results[activeIdx].href);
            }}
            placeholder="Search modules or ask the copilot…"
            className="w-full bg-transparent py-3.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <kbd className="rounded-full border border-white/10 px-1.5 py-0.5 text-[10px] text-zinc-500">ESC</kbd>
        </div>
        <div id="command-results" role="listbox" aria-label="Commands" className="max-h-[min(320px,60dvh)] overflow-y-auto p-1.5">
          {results.length === 0 && (
            <p role="status" className="px-3 py-6 text-center text-xs text-muted-foreground">No matches</p>
          )}
          {results.map((r, i) => {
            const showGroup = i === 0 || results[i - 1].group !== r.group;
            return (
              <div key={`${r.label}-${i}`}>
                {showGroup && (
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">{r.group}</p>
                )}
                <button
                  id={`command-${i}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  tabIndex={-1}
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

function Topbar({ collapsed, onOpenPalette, onOpenMenu, menuOpen }: { collapsed: boolean; onOpenPalette: () => void; onOpenMenu: () => void; menuOpen: boolean }) {
  const pathname = usePathname();
  const { user } = useUser();
  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Operator';
  const [errorCount, setErrorCount] = useState<number | null>(null);
  const today = useMemo(() => new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), []);
  const title = NAV_GROUPS.flatMap(group => group.items).find(item => item.href === pathname)?.label ?? 'Flow-Pilot';

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
    <header
      className="sticky top-0 z-40 flex min-h-14 min-w-0 items-center gap-2 bg-[#17171C] px-3 pt-3 md:gap-4 md:px-5"
    >
        <button onClick={onOpenMenu} aria-label="Open navigation" aria-expanded={menuOpen} aria-controls="shell-navigation" className="shrink-0 rounded-md p-2 hover:bg-accent md:hidden">
          <Menu size={20} />
        </button>
        <div className="hidden min-w-0 items-center gap-3 md:flex">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-white" style={{ background: ACCENT }}>
            {displayName[0].toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100">{displayName}</p>
            <p className="truncate text-[11px] text-zinc-500">{user?.emailAddresses?.[0]?.emailAddress ?? ''}</p>
          </div>
        </div>
        <button
          onClick={onOpenPalette}
          aria-label="Jump to module or search commands"
          className="group ml-auto flex h-11 min-w-0 items-center gap-2 rounded-full border border-white/10 bg-[#222228] px-3 text-xs text-zinc-400 transition-colors hover:border-white/20 md:min-w-[220px]"
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
        <h1 className={`min-w-0 truncate text-sm font-semibold tracking-tight ${collapsed ? '' : 'hidden md:block'}`}>{title}</h1>

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
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useModalFocus(menuOpen, drawerRef, closeMenu);
  const pathname = usePathname();
  const { user } = useUser();
  const palette = useCommandPalette();
  const operatorName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Operator';
  const operatorEmail = user?.emailAddresses?.[0]?.emailAddress ?? '';

  useEffect(() => {
    closeMenu();
  }, [pathname, closeMenu]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)');
    const resize = () => { if (media.matches) closeMenu(); };
    media.addEventListener('change', resize);
    return () => media.removeEventListener('change', resize);
  }, [closeMenu]);

  return (
    <div className="flex h-screen w-full gap-3 overflow-hidden bg-[#08080A] p-2.5 sm:p-3">
      {menuOpen && <div aria-hidden="true" className="fixed inset-0 z-50 bg-black/60 md:hidden" onClick={closeMenu} />}
      <aside
        ref={drawerRef}
        id="shell-navigation"
        role={menuOpen ? 'dialog' : undefined}
        aria-modal={menuOpen ? true : undefined}
        aria-label="Navigation"
        inert={palette.open}
        className={`fp-sidebar ${menuOpen ? 'fp-sidebar-open' : ''} h-full shrink-0 flex-col rounded-[24px] bg-[#121217] p-3 transition-all duration-200 ${
          collapsed ? 'w-[64px]' : 'w-[228px]'
        }`}
      >
        <div className="flex h-14 items-center gap-2.5 px-2">
          {menuOpen && <button aria-label="Close navigation" onClick={closeMenu} className="rounded p-1 hover:bg-accent md:hidden"><X size={20} /></button>}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[15px] font-black text-white" style={{ background: ACCENT }}>
            ⌁
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[19px] font-semibold leading-tight">Flow-Pilot</p>
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
                    onClick={closeMenu}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    className={`relative mb-0.5 flex items-center gap-2.5 rounded-full px-3.5 py-2.5 text-[13px] transition-colors ${
                      active
                        ? 'bg-white font-medium text-black'
                        : 'text-zinc-400 hover:bg-white/5 hover:text-white'
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

        {!collapsed && (
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
              onClick={closeMenu}
              className="mt-3 flex h-10 items-center justify-center rounded-full bg-black text-[13px] font-semibold text-white transition-transform hover:scale-[1.02]"
            >
              Upgrade Now
            </Link>
          </div>
        )}
        <div className="border-t border-border p-2.5">
          <div className={`flex items-center gap-2.5 rounded-md px-1.5 py-1.5 ${collapsed ? 'justify-center' : ''}`}>
            <UserButton afterSignOutUrl="/" />
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{operatorName}</p>
                <p className="truncate text-[10px] text-muted-foreground">{operatorEmail}</p>
              </div>
            )}
            {!collapsed && (
              <button
                onClick={() => { if (menuOpen) closeMenu(); else setCollapsed(true); }}
                className="rounded p-1 text-muted-foreground hover:bg-accent"
                aria-label={menuOpen ? 'Close sidebar' : 'Collapse sidebar'}
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
              ⌁
            </button>
          )}
        </div>
        </aside>

      <div inert={menuOpen || palette.open} className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#17171C]">
        <Topbar collapsed={collapsed} menuOpen={menuOpen} onOpenMenu={() => { setCollapsed(false); setMenuOpen(true); }} onOpenPalette={() => palette.setOpen(true)} />
        <main className="flex-1 overflow-y-auto px-4 pb-6 pt-4 sm:px-6">{children}</main>
      </div>
      <CommandPalette palette={palette} />
    </div>
  );
}
