'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gift, Ticket, Clock, Award, TrendingUp, RefreshCw, Plus, Search, AlertTriangle } from 'lucide-react';

interface Scheme {
  _id: string;
  code: string;
  title: string;
  description: string;
  benefitType: string;
  benefitValueMinor: number;
  maxDiscountMinor?: number;
  status: string;
  priority: number;
  holdoutPercent: number;
  eligibility: { cohorts: string[]; minOrders: number; minTenureDays: number };
  limits: { validFrom: string; validUntil: string; maxRedemptionsGlobal?: number };
  counters: { issued: number; redeemed: number; holdout: number };
  createdAt: string;
}

export default function PromotionsPage() {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'schemes' | 'analytics'>('schemes');
  const [previewResult, setPreviewResult] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [eligibleEmail, setEligibleEmail] = useState('');
  const [eligibleResult, setEligibleResult] = useState<any>(null);

  // form state
  const [form, setForm] = useState({
    code: '',
    title: '',
    description: '',
    benefitType: 'percent' as any,
    benefitValueMinor: 500,
    maxDiscountMinor: 100000,
    holdoutPercent: 10,
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10),
    cohorts: ['regular'] as string[],
    minOrders: 4,
    minTenureDays: 180,
  });

  const fetchSchemes = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/schemes?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed');
      setSchemes(json.data || []);
      setError(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics/schemes');
      const json = await res.json();
      if (res.ok) setAnalytics(json);
    } catch {}
  }, []);

  useEffect(() => {
    fetchSchemes();
  }, [fetchSchemes]);

  useEffect(() => {
    if (activeTab === 'analytics') fetchAnalytics();
  }, [activeTab, fetchAnalytics]);

  const handleCreate = async () => {
    try {
      const payload: any = {
        code: form.code,
        title: form.title,
        description: form.description,
        benefitType: form.benefitType,
        benefitValueMinor: Number(form.benefitValueMinor),
        maxDiscountMinor: form.maxDiscountMinor ? Number(form.maxDiscountMinor) : undefined,
        holdoutPercent: Number(form.holdoutPercent),
        eligibility: {
          cohorts: form.cohorts,
          minOrders: Number(form.minOrders),
          minTenureDays: Number(form.minTenureDays),
          maxRecencyDays: 90,
        },
        limits: {
          validFrom: new Date(form.validFrom).toISOString(),
          validUntil: new Date(form.validUntil).toISOString(),
          maxRedemptionsPerCustomer: 1,
        },
      };
      // percent is basis points: UI shows 5% -> 500
      // if user entered 5, treat as 5% = 500
      if (form.benefitType === 'percent' && payload.benefitValueMinor < 100) {
        payload.benefitValueMinor = payload.benefitValueMinor * 100;
      }

      const res = await fetch('/api/schemes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setShowCreate(false);
      setForm({ ...form, code: '', title: '' });
      fetchSchemes();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handlePreview = async (schemeId: string) => {
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/schemes/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ schemeId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setPreviewResult(json);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleEligible = async () => {
    if (!eligibleEmail.includes('@')) return alert('Enter valid email');
    const res = await fetch(`/api/schemes/eligible?email=${encodeURIComponent(eligibleEmail)}`);
    const json = await res.json();
    setEligibleResult(json);
  };

  const handleStatus = async (id: string, action: 'submit' | 'approve' | 'pause') => {
    const res = await fetch(`/api/schemes/${id}/${action}`, { method: 'POST' });
    const json = await res.json();
    if (!res.ok) return alert(json.error);
    fetchSchemes();
  };

  const handleIssue = async (id: string) => {
    if (!confirm('Issue coupons to all eligible? Holdout will be applied.')) return;
    const res = await fetch('/api/admin/schemes/issue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schemeId: id }),
    });
    const json = await res.json();
    if (!res.ok) return alert(json.error);
    alert(`Issued: ${json.issued}, Holdout: ${json.holdout}, Eligible: ${json.totalEligible}`);
    fetchSchemes();
    fetchAnalytics();
  };

  const handleRebuild = async () => {
    const res = await fetch('/api/admin/signals/rebuild', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    const json = await res.json();
    alert((json as any).error ? (json as any).error : `Rebuilt signals: ${json.updated}/${json.total}`);
  };

  const cohortLabel = (c: string) => {
    const map: any = { regular: 'Regular', active_tenured: 'Active Tenured', slipping: 'Slipping', dormant_tenured: 'Dormant Tenured' };
    return map[c] || c;
  };

  const statusColor = (s: string) => {
    switch (s) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'pending_approval':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'draft':
        return 'bg-slate-50 text-slate-700 border-slate-200';
      case 'paused':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <Ticket className="w-7 h-7 text-blue-600" /> Promotions
            </h1>
            <p className="text-slate-600">Loyalty schemes for Regular, Active Tenured, Slipping & Dormant cohorts</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleRebuild} className="px-3 py-2 bg-white border rounded-lg text-sm">Rebuild Signals</button>
            <button onClick={() => fetchSchemes()} className="inline-flex items-center gap-2 px-4 py-2 bg-white border rounded-lg text-sm">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
              <Plus className="w-4 h-4" /> New Scheme
            </button>
          </div>
        </div>

        <div className="flex gap-2 border-b">
          <button
            onClick={() => setActiveTab('schemes')}
            className={`px-4 py-2 border-b-2 text-sm font-medium ${activeTab === 'schemes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600'}`}
          >
            Schemes
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-4 py-2 border-b-2 text-sm font-medium ${activeTab === 'analytics' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-600'}`}
          >
            Analytics
          </button>
        </div>

        {activeTab === 'schemes' && (
          <>
            <Card>
              <CardContent className="p-4 flex flex-col lg:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search by code or title..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
                  />
                </div>
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Eligibility Check</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <input
                    value={eligibleEmail}
                    onChange={(e) => setEligibleEmail(e.target.value)}
                    placeholder="customer@example.com"
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                  />
                  <button onClick={handleEligible} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                    Check
                  </button>
                </div>
                {eligibleResult && (
                  <div className="bg-slate-50 p-3 rounded-lg text-sm">
                    <p className="font-medium">Signal: {eligibleResult.signal ? JSON.stringify(eligibleResult.signal, null, 2) : eligibleResult.reason}</p>
                    {eligibleResult.matched?.length > 0 ? (
                      <ul className="list-disc pl-5 mt-2">
                        {eligibleResult.matched.map((m: any) => (
                          <li key={m.code}>
                            {m.code} — {m.title} ({m.benefitType} {m.benefitValueMinor})
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-slate-500 mt-2">No eligible schemes</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {loading ? (
              <div className="text-center py-12 text-slate-500">Loading...</div>
            ) : error ? (
              <div className="text-center py-12 text-red-600">{error}</div>
            ) : schemes.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center text-slate-500">
                  <Gift className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                  No schemes yet — create one to reward Regular & Active Tenured customers
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {schemes.map((s) => (
                  <Card key={s._id} className="hover:shadow-md transition">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-slate-900">{s.code}</span>
                            <span className={`px-2 py-0.5 rounded-full border text-xs ${statusColor(s.status)}`}>{s.status}</span>
                            <span className="text-xs text-slate-500">priority {s.priority}</span>
                            <span className="text-xs text-slate-500">holdout {s.holdoutPercent}%</span>
                          </div>
                          <p className="font-medium text-slate-900 mt-1">{s.title}</p>
                          <p className="text-sm text-slate-600">{s.description}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {s.eligibility.cohorts.map((c) => (
                              <span key={c} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs border border-blue-200">
                                {cohortLabel(c)}
                              </span>
                            ))}
                            <span className="text-xs text-slate-500">
                              {s.benefitType} {s.benefitType === 'percent' ? `${(s.benefitValueMinor / 100).toFixed(0)}%` : `₹${s.benefitValueMinor / 100}`}
                              {s.maxDiscountMinor ? ` cap ₹${s.maxDiscountMinor / 100}` : ''}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-2">
                            {new Date(s.limits.validFrom).toLocaleDateString()} → {new Date(s.limits.validUntil).toLocaleDateString()} • Issued {s.counters.issued} Redeemed {s.counters.redeemed}{' '}
                            Holdout {s.counters.holdout}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          {s.status === 'draft' && (
                            <button onClick={() => handleStatus(s._id, 'submit')} className="px-3 py-1 bg-amber-600 text-white rounded text-xs">
                              Submit
                            </button>
                          )}
                          {s.status === 'pending_approval' && (
                            <button onClick={() => handleStatus(s._id, 'approve')} className="px-3 py-1 bg-emerald-600 text-white rounded text-xs">
                              Approve
                            </button>
                          )}
                          {s.status === 'active' && (
                            <>
                              <button onClick={() => handlePreview(s._id)} className="px-3 py-1 bg-white border rounded text-xs">
                                {previewLoading ? '...' : 'Dry Run'}
                              </button>
                              <button onClick={() => handleIssue(s._id)} className="px-3 py-1 bg-blue-600 text-white rounded text-xs">
                                Issue
                              </button>
                              <button onClick={() => handleStatus(s._id, 'pause')} className="px-3 py-1 bg-slate-600 text-white rounded text-xs">
                                Pause
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {previewResult && (
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-sm">Preview Result</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-1">
                  <p>Matched: {previewResult.matched} (Treated {previewResult.treated}, Holdout {previewResult.holdoutCount})</p>
                  <p>By Cohort: {JSON.stringify(previewResult.byCohort)}</p>
                  <p>Estimated Liability: {previewResult.estimatedLiabilityFormatted}</p>
                  <p>Holdout: {previewResult.holdoutPercent}%</p>
                  {previewResult.powerWarning && <p className="text-amber-700">{previewResult.powerWarning}</p>}
                  {previewResult.liabilityBlocked && <p className="text-red-600 font-medium">Liability exceeds ₹10L — requires finance approval</p>}
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-4">
            {!analytics ? (
              <div className="text-center py-12 text-slate-500">No analytics yet — issue a scheme first</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-slate-500">Total Issued</p>
                      <p className="text-2xl font-bold">{analytics.summary?.totalIssued}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-slate-500">Redeemed</p>
                      <p className="text-2xl font-bold">{analytics.summary?.totalRedeemed}</p>
                      <p className="text-xs text-slate-500">{analytics.summary?.redemptionRate}% rate</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-slate-500">Incremental</p>
                      <p className="text-2xl font-bold">{analytics.summary?.totalIncrementalFormatted}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-xs text-slate-500">Schemes</p>
                      <p className="text-2xl font-bold">{analytics.schemes?.length}</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="grid gap-3">
                  {analytics.schemes?.map((r: any) => (
                    <Card key={r.schemeId}>
                      <CardContent className="p-4">
                        <div className="flex justify-between">
                          <span className="font-mono font-bold">{r.code}</span>
                          <span className="text-xs px-2 py-0.5 bg-slate-100 rounded">{r.redeemed}/{r.issued} redeemed</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs mt-3">
                          <div>Holdout {r.holdout} (N {r.holdoutN})</div>
                          <div>Reactivation Treated {r.reactivationRateTreated}%</div>
                          <div>Holdout {r.reactivationRateHoldout}%</div>
                        </div>
                        <div className="text-xs mt-2">ROI {r.roi} • Incremental ₹{r.incrementalRevenueMinor / 100}</div>
                        {r.powerWarning && <p className="text-xs text-amber-600 mt-1">{r.powerWarning}</p>}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <h3 className="font-bold">Create Scheme</h3>
              <p className="text-sm text-slate-500">Strict preset hides raw 0.35 — commercial simple form</p>
            </div>
            <div className="p-6 space-y-4">
              <input
                placeholder="Code e.g. LOYAL10"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <input
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <select value={form.benefitType} onChange={(e) => setForm({ ...form, benefitType: e.target.value as any })} className="border rounded-lg px-3 py-2 text-sm">
                  <option value="percent">Percent %</option>
                  <option value="fixed">Fixed ₹</option>
                  <option value="free_setup">Free Setup</option>
                </select>
                <input
                  type="number"
                  placeholder={form.benefitType === 'percent' ? '5 for 5%' : '500 for ₹500'}
                  value={form.benefitValueMinor}
                  onChange={(e) => setForm({ ...form, benefitValueMinor: Number(e.target.value) })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  placeholder="Cap paise (e.g. 100000)"
                  value={form.maxDiscountMinor}
                  onChange={(e) => setForm({ ...form, maxDiscountMinor: Number(e.target.value) })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="Holdout %"
                  value={form.holdoutPercent}
                  onChange={(e) => setForm({ ...form, holdoutPercent: Number(e.target.value) })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Cohorts</p>
                <div className="flex flex-wrap gap-2">
                  {['regular', 'active_tenured', 'slipping', 'dormant_tenured'].map((c) => (
                    <label key={c} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={form.cohorts.includes(c)}
                        onChange={(e) => {
                          if (e.target.checked) setForm({ ...form, cohorts: [...form.cohorts, c] });
                          else setForm({ ...form, cohorts: form.cohorts.filter((x) => x !== c) });
                        }}
                      />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="date"
                  value={form.validFrom}
                  onChange={(e) => setForm({ ...form, validFrom: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={form.validUntil}
                  onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
                  className="border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowCreate(false)} className="px-4 py-2 border rounded-lg text-sm">
                  Cancel
                </button>
                <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">
                  Create Draft
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
