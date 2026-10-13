'use client';

import { useDeferredValue, useEffect, useState } from 'react';
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, BadgePoundSterling,
  CircleGauge, Database, Globe2, LoaderCircle, PackageX, RefreshCw,
  Search, ShieldAlert, Users,
} from 'lucide-react';

interface Dealer {
  _id: string;
  dealerCode: string;
  name: string;
  country: string;
  orderCount: number;
  revenue: number;
  returnRate: number;
  serviceLevel: number;
  creditLimit: number;
  outstanding: number;
  overdue: number;
  creditUtilization: number;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  lastOrder: string;
}

interface Overview {
  available: boolean;
  source: { name: string; license: string; doi: string; import?: { rowsRead?: number; invoicesWritten?: number; status?: string } };
  summary: {
    dealers: number; active: number; onCreditHold: number; revenue: number;
    returnValue: number; outstanding: number; overdue: number;
    avgServiceLevel: number; highRisk: number; returnRate: number; creditUtilization: number;
  };
  territories: Array<{ country: string; dealers: number; revenue: number; overdue: number; returns: number; serviceLevel: number }>;
  trend: Array<{ date: string; revenue: number; returnValue: number; orders: number; activeDealers: number }>;
  riskQueue: Dealer[];
  recentReturns: Array<{ _id: string; invoiceNo: string; dealerCode: string; country: string; activityDate: string; grossValue: number; units: number }>;
  topProducts: Array<{ _id: string; sku: string; name: string; revenue: number; units: number; returnRate: number; stockOnHand: number }>;
}

interface DealerResponse {
  data: Dealer[];
  filters: { countries: string[] };
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

const money = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 });

export default function DealerNetworkPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [dealers, setDealers] = useState<DealerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [dealerError, setDealerError] = useState('');
  const [dealersLoading, setDealersLoading] = useState(true);
  const [dealerRetry, setDealerRetry] = useState(0);
  const [query, setQuery] = useState('');
  const [risk, setRisk] = useState('all');
  const [country, setCountry] = useState('');
  const [sort, setSort] = useState('revenue');
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<'overview' | 'accounts' | 'exceptions'>('overview');
  const deferredQuery = useDeferredValue(query);

  async function loadOverview() {
    setLoading(true);
    setOverviewError('');
    try {
      const response = await fetch('/api/network/overview');
      if (!response.ok) throw new Error('Failed to load network overview');
      setOverview(await response.json());
    } catch {
      setOverviewError('Failed to load network overview. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadOverview(); }, []);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '25', sort });
    if (deferredQuery.trim()) params.set('q', deferredQuery.trim());
    if (risk !== 'all') params.set('risk', risk);
    if (country) params.set('country', country);
    const controller = new AbortController();
    setDealerError('');
    setDealersLoading(true);
    fetch(`/api/network/dealers?${params}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Dealer query failed')))
      .then(setDealers)
      .catch((error) => {
        if (!controller.signal.aborted) {
          console.error(error);
          setDealerError('Failed to load dealer accounts. Please try again.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDealersLoading(false);
      });
    return () => controller.abort();
  }, [country, deferredQuery, page, risk, sort, dealerRetry]);

  if (loading && !overview) {
    return <div className="flex min-h-[70vh] items-center justify-center text-muted-foreground"><LoaderCircle className="mr-2 animate-spin" size={18} /> Loading dealer network…</div>;
  }

  if (overviewError) {
    return <div className="mx-auto max-w-xl px-6 py-20 text-center"><p role="alert" className="mb-4 text-rose-400">{overviewError}</p><button onClick={() => void loadOverview()} className="rounded border border-border px-4 py-2">Retry</button></div>;
  }

  if (!overview?.available) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20">
        <div className="panel p-8 text-center">
          <Database className="mx-auto mb-4 text-primary" size={34} />
          <h1 className="text-xl font-semibold">Public demo warehouse is ready to import</h1>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Load 541,909 licensed wholesale transaction lines from UCI into isolated demo collections. Live tenant data is never modified.</p>
          <code className="mt-6 block rounded-lg border border-border bg-background px-4 py-3 text-left text-xs text-blue-300">npm run data:import:uci -- --reset</code>
          <p className="mt-4 text-[11px] text-muted-foreground">UCI Online Retail · CC BY 4.0 · DOI 10.24432/C5BW33</p>
        </div>
      </div>
    );
  }

  const maxRevenue = Math.max(...overview.trend.map((day) => day.revenue), 1);

  return (
    <div className="min-h-full bg-background px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-5">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold tracking-tight">Dealer Network</h1><span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-300">PUBLIC DEMO</span></div>
            <p className="mt-1 text-sm text-muted-foreground">Account health, credit exposure, service levels, returns and territory execution.</p>
          </div>
          <div className="flex items-center gap-3"><div className="hidden text-right text-[11px] text-muted-foreground sm:block"><p>{compact.format(overview.source.import?.rowsRead ?? 0)} source lines · {compact.format(overview.source.import?.invoicesWritten ?? 0)} invoices</p><p>{overview.source.name} · {overview.source.license}</p></div><button onClick={() => void loadOverview()} className="rounded-md border border-border bg-card p-2 text-muted-foreground hover:text-foreground" aria-label="Refresh"><RefreshCw size={15} /></button></div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Kpi icon={<Users size={16} />} label="Dealer accounts" value={compact.format(overview.summary.dealers)} note={`${compact.format(overview.summary.active)} active`} />
          <Kpi icon={<BadgePoundSterling size={16} />} label="Network revenue" value={money.format(overview.summary.revenue)} note="Gross public transactions" />
          <Kpi icon={<CircleGauge size={16} />} label="Service level" value={`${overview.summary.avgServiceLevel.toFixed(1)}%`} note="Synthetic OTIF proxy" tone="good" />
          <Kpi icon={<ShieldAlert size={16} />} label="Credit exposure" value={money.format(overview.summary.outstanding)} note={`${overview.summary.creditUtilization.toFixed(1)}% utilized`} tone={overview.summary.creditUtilization > 85 ? 'bad' : 'neutral'} />
          <Kpi icon={<AlertTriangle size={16} />} label="Overdue" value={money.format(overview.summary.overdue)} note={`${overview.summary.highRisk} high-risk accounts`} tone="bad" />
          <Kpi icon={<PackageX size={16} />} label="Return leakage" value={`${overview.summary.returnRate.toFixed(2)}%`} note={money.format(overview.summary.returnValue)} tone={overview.summary.returnRate > 5 ? 'bad' : 'neutral'} />
        </div>

        <div className="flex gap-1 border-b border-border">
          {(['overview', 'accounts', 'exceptions'] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`border-b-2 px-4 py-2.5 text-xs font-medium capitalize ${tab === item ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{item}</button>)}
        </div>

        {tab === 'overview' && <OverviewTab overview={overview} maxRevenue={maxRevenue} />}

        {tab === 'accounts' && (
          <section className="panel overflow-hidden">
            <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row">
              <label className="relative flex-1"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search dealer code or customer…" className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-xs outline-none focus:border-primary" /></label>
              <select value={risk} onChange={(event) => { setRisk(event.target.value); setPage(1); }} className="h-9 rounded-md border border-border bg-background px-3 text-xs"><option value="all">All risk levels</option><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select>
              <select value={country} onChange={(event) => { setCountry(event.target.value); setPage(1); }} className="h-9 max-w-52 rounded-md border border-border bg-background px-3 text-xs"><option value="">All territories</option>{dealers?.filters.countries.map((item) => <option key={item}>{item}</option>)}</select>
              <select value={sort} onChange={(event) => setSort(event.target.value)} className="h-9 rounded-md border border-border bg-background px-3 text-xs"><option value="revenue">Revenue</option><option value="riskScore">Risk score</option><option value="outstanding">Outstanding</option><option value="lastOrder">Last order</option></select>
            </div>
            {dealerError ? (
              <div className="p-5"><p role="alert" className="mb-3 text-rose-400">{dealerError}</p><button onClick={() => setDealerRetry((value) => value + 1)} className="rounded border border-border px-3 py-2">Retry dealer accounts</button></div>
            ) : dealersLoading ? (
              <p role="status" className="p-5 text-muted-foreground">Loading dealer accounts…</p>
            ) : dealers?.data.length ? (
              <DealerTable dealers={dealers.data} />
            ) : (
              <p className="p-5 text-muted-foreground">No dealer accounts match these filters.</p>
            )}
            {!dealerError && !dealersLoading && (
            <div className="flex items-center justify-between border-t border-border px-5 py-3 text-xs text-muted-foreground"><span>{dealers?.pagination.total.toLocaleString() ?? 0} accounts</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)} className="rounded border border-border px-3 py-1.5 disabled:opacity-40">Previous</button><span>Page {page} of {dealers?.pagination.totalPages ?? 1}</span><button disabled={page >= (dealers?.pagination.totalPages ?? 1)} onClick={() => setPage((value) => value + 1)} className="rounded border border-border px-3 py-1.5 disabled:opacity-40">Next</button></div></div>
            )}
          </section>
        )}

        {tab === 'exceptions' && <ExceptionsTab overview={overview} />}

        <footer className="flex flex-col justify-between gap-2 border-t border-border py-4 text-[10px] text-muted-foreground sm:flex-row"><span>Source: UCI Machine Learning Repository, Online Retail · CC BY 4.0 · DOI 10.24432/C5BW33</span><span>Credit and service fields are deterministic demo enrichments, not source attributes.</span></footer>
      </div>
    </div>
  );
}

function OverviewTab({ overview, maxRevenue }: { overview: Overview; maxRevenue: number }) {
  return <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
    <section className="panel p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-medium">90-day commercial pulse</p><p className="text-xs text-muted-foreground">Revenue bars with return overlays</p></div><span className="label-xs">GBP</span></div><div className="mt-6 flex h-48 items-end gap-[2px]">{overview.trend.map((day) => <div key={day.date} className="group relative flex min-w-0 flex-1 flex-col justify-end" title={`${day.date}: ${money.format(day.revenue)} · ${day.orders} orders`}><div className="w-full rounded-t-sm bg-blue-500/70 transition-colors group-hover:bg-blue-400" style={{ height: `${Math.max(2, day.revenue / maxRevenue * 100)}%` }} />{day.returnValue > 0 && <div className="absolute bottom-0 w-full bg-rose-400" style={{ height: `${Math.max(2, day.returnValue / maxRevenue * 100)}%` }} />}</div>)}</div><div className="mt-3 flex justify-between text-[10px] text-muted-foreground"><span>{overview.trend[0]?.date}</span><span>{overview.trend.at(-1)?.date}</span></div></section>
    <section className="panel overflow-hidden"><div className="border-b border-border px-5 py-4"><p className="text-sm font-medium">Territory performance</p><p className="text-xs text-muted-foreground">Top markets by revenue</p></div><div className="divide-y divide-border">{overview.territories.slice(0, 7).map((territory, index) => <div key={territory.country} className="grid grid-cols-[28px_1fr_auto] items-center gap-3 px-5 py-3"><span className="text-[11px] text-muted-foreground">{String(index + 1).padStart(2, '0')}</span><div className="min-w-0"><p className="truncate text-xs font-medium">{territory.country}</p><p className="text-[10px] text-muted-foreground">{territory.dealers} dealers · {territory.serviceLevel.toFixed(1)}% service</p></div><div className="text-right"><p className="text-xs font-medium tabular-nums">{money.format(territory.revenue)}</p><p className="text-[10px] text-muted-foreground">{money.format(territory.overdue)} overdue</p></div></div>)}</div></section>
    <section className="panel overflow-hidden xl:col-span-2"><div className="border-b border-border px-5 py-4"><p className="text-sm font-medium">Top product velocity</p><p className="text-xs text-muted-foreground">Commercial value, units and return leakage</p></div><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-secondary/50 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3">SKU / product</th><th className="px-4 py-3 text-right">Units</th><th className="px-4 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Returns</th><th className="px-5 py-3 text-right">Stock proxy</th></tr></thead><tbody className="divide-y divide-border">{overview.topProducts.slice(0, 8).map((product) => <tr key={product._id} className="hover:bg-accent/40"><td className="px-5 py-3"><p className="font-medium">{product.name}</p><p className="text-[10px] text-muted-foreground">{product.sku}</p></td><td className="px-4 py-3 text-right tabular-nums">{compact.format(product.units)}</td><td className="px-4 py-3 text-right tabular-nums">{money.format(product.revenue)}</td><td className={`px-4 py-3 text-right tabular-nums ${product.returnRate > 5 ? 'text-rose-400' : ''}`}>{product.returnRate.toFixed(2)}%</td><td className="px-5 py-3 text-right tabular-nums">{compact.format(product.stockOnHand)}</td></tr>)}</tbody></table></div></section>
  </div>;
}

function ExceptionsTab({ overview }: { overview: Overview }) {
  return <div className="grid gap-4 xl:grid-cols-2"><section className="panel overflow-hidden"><div className="border-b border-border px-5 py-4"><p className="flex items-center gap-2 text-sm font-medium"><ShieldAlert size={15} className="text-rose-400" /> Credit and account-risk queue</p><p className="text-xs text-muted-foreground">Prioritized by composite risk score</p></div><DealerTable dealers={overview.riskQueue} compactMode /></section><section className="panel overflow-hidden"><div className="border-b border-border px-5 py-4"><p className="flex items-center gap-2 text-sm font-medium"><PackageX size={15} className="text-amber-400" /> Recent return activity</p><p className="text-xs text-muted-foreground">Cancellation invoices requiring review</p></div><div className="divide-y divide-border">{overview.recentReturns.map((item) => <div key={item._id} className="grid grid-cols-[1fr_auto] gap-4 px-5 py-3"><div><p className="text-xs font-medium">Return {item.invoiceNo}</p><p className="text-[10px] text-muted-foreground">{item.dealerCode} · {item.country} · {item.activityDate}</p></div><div className="text-right"><p className="text-xs font-medium text-rose-300">{money.format(item.grossValue)}</p><p className="text-[10px] text-muted-foreground">{item.units} units</p></div></div>)}</div></section></div>;
}

function Kpi({ icon, label, value, note, tone = 'neutral' }: { icon: React.ReactNode; label: string; value: string; note: string; tone?: 'neutral' | 'good' | 'bad' }) {
  return <div className="panel p-4"><div className={`mb-3 flex h-7 w-7 items-center justify-center rounded-md ${tone === 'bad' ? 'bg-rose-500/10 text-rose-400' : tone === 'good' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'}`}>{icon}</div><p className="label-xs">{label}</p><p className="mt-1 truncate text-xl font-semibold tabular-nums">{value}</p><p className="mt-1 truncate text-[10px] text-muted-foreground">{note}</p></div>;
}

function DealerTable({ dealers, compactMode = false }: { dealers: Dealer[]; compactMode?: boolean }) {
  if (compactMode) return <div className="divide-y divide-border">{dealers.map((dealer) => <div key={dealer._id} className="grid grid-cols-[1fr_auto] gap-4 px-5 py-3"><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-xs font-medium">{dealer.name}</p><RiskBadge risk={dealer.riskLevel} /></div><p className="text-[10px] text-muted-foreground">{dealer.dealerCode} · {dealer.country} · {dealer.serviceLevel.toFixed(1)}% service</p></div><div className="text-right"><p className="text-xs font-medium">{money.format(dealer.overdue)} overdue</p><p className="text-[10px] text-muted-foreground">{dealer.creditUtilization.toFixed(0)}% credit used</p></div></div>)}</div>;
  return <div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-left text-xs"><thead className="bg-secondary/50 text-[10px] uppercase tracking-wider text-muted-foreground"><tr><th className="px-5 py-3">Account</th><th className="px-4 py-3">Territory</th><th className="px-4 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Service</th><th className="px-4 py-3 text-right">Outstanding</th><th className="px-4 py-3 text-right">Overdue</th><th className="px-4 py-3 text-right">Returns</th><th className="px-5 py-3">Risk</th></tr></thead><tbody className="divide-y divide-border">{dealers.map((dealer) => <tr key={dealer._id} className="hover:bg-accent/30"><td className="px-5 py-3"><p className="font-medium">{dealer.name}</p><p className="text-[10px] text-muted-foreground">{dealer.dealerCode} · {dealer.orderCount} orders</p></td><td className="px-4 py-3"><span className="flex items-center gap-1.5"><Globe2 size={12} className="text-muted-foreground" />{dealer.country}</span></td><td className="px-4 py-3 text-right tabular-nums">{money.format(dealer.revenue)}</td><td className="px-4 py-3 text-right"><span className={`inline-flex items-center gap-1 ${dealer.serviceLevel >= 95 ? 'text-emerald-400' : 'text-amber-400'}`}>{dealer.serviceLevel >= 95 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{dealer.serviceLevel.toFixed(1)}%</span></td><td className="px-4 py-3 text-right tabular-nums">{money.format(dealer.outstanding)}</td><td className="px-4 py-3 text-right tabular-nums text-rose-300">{money.format(dealer.overdue)}</td><td className="px-4 py-3 text-right tabular-nums">{dealer.returnRate.toFixed(2)}%</td><td className="px-5 py-3"><RiskBadge risk={dealer.riskLevel} /></td></tr>)}</tbody></table></div>;
}

function RiskBadge({ risk }: { risk: Dealer['riskLevel'] }) {
  const style = risk === 'critical' ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : risk === 'high' ? 'border-orange-500/20 bg-orange-500/10 text-orange-300' : risk === 'medium' ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300';
  return <span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${style}`}>{risk}</span>;
}
