export interface KnowledgeDoc {
  id: string;
  title: string;
  tags: string[];
  content: string;
}

/**
 * Curated distribution-management domain corpus. Grounded in standard
 * FMCG/distribution industry practice (primary vs secondary sales, OTIF,
 * fill rate, GMROI, ABC/XYZ, RFM). The copilot cites these as [K#] sources.
 */
export const KNOWLEDGE_CORPUS: KnowledgeDoc[] = [
  {
    id: 'k-primary-secondary-sales',
    title: 'Primary vs Secondary Sales',
    tags: ['sales', 'distribution', 'funnel'],
    content:
      'Primary sales are goods sold by the brand to distributors/dealers (stock leaves the brand warehouse). Secondary sales are distributor-to-retailer sales; tertiary sales are retailer-to-end-customer. Healthy networks track all three: high primary with weak secondary signals channel stuffing — inventory piling at dealers that will suppress future primary orders and raise return risk. Flow Pilot order data is primary sales; watch secondary indicators via dealer reorder cadence.',
  },
  {
    id: 'k-otif-fill-rate',
    title: 'OTIF and Fill Rate',
    tags: ['service', 'kpi', 'fulfillment'],
    content:
      'Fill rate = lines/units shipped complete on first shipment ÷ lines/units ordered. OTIF (On-Time In-Full) counts only orders delivered complete AND within the promised window — the strictest customer-service KPI. World-class distribution runs ≥97% fill rate and ≥95% OTIF. Low OTIF drivers: stockouts at pick time, split shipments, lead-time variance. Track per-dealer OTIF to prioritize which accounts get safety-stock priority during shortages.',
  },
  {
    id: 'k-sell-through',
    title: 'Sell-Through Rate',
    tags: ['inventory', 'velocity', 'retail'],
    content:
      'Sell-through % = units sold to end customers ÷ units received from supplier, over a period (typically 4 weeks). Below ~40% monthly for fast-moving categories means overstocked channels; above ~80% suggests under-stocking and lost demand. Use sell-through bands to tune dealer replenishment quantity instead of flat reorder cycles.',
  },
  {
    id: 'k-gmroi',
    title: 'GMROI — Gross Margin Return on Inventory',
    tags: ['finance', 'margin', 'inventory'],
    content:
      'GMROI = gross margin $ ÷ average inventory cost. It answers "how many rupees of margin does each rupee of inventory generate". GMROI of 2.0–3.5 is typical retail; below 1.0 means inventory destroys value — capital would earn more elsewhere. Pair GMROI with velocity: high-margin slow movers can still have poor GMROI once holding cost (~2%/month) and depreciation are charged.',
  },
  {
    id: 'k-dead-stock',
    title: 'Dead Stock & Liquidation Playbook',
    tags: ['deadstock', 'risk', 'liquidation'],
    content:
      'Dead stock = inventory with zero sales in a defined window (commonly 90–180 days) or turnover < 1x/year. Cost stack while it sits: tied-up capital, storage ~2%/month, opportunity cost ~1%/month, obsolescence risk rising with age. Liquidation ladder: bundle with fast movers → tiered markdowns (20→40→60%) → B2B jobber/off-price clearance → donation/write-off for tax recovery. Flag earlier than 90 days when demand trend is negative and stock cover exceeds 6 months.',
  },
  {
    id: 'k-abc-analysis',
    title: 'ABC Analysis (Pareto Inventory Classification)',
    tags: ['classification', 'prioritization', 'inventory'],
    content:
      'Rank SKUs by annual consumption value (price × annual units). A-items ≈ top 80% of value (~15–20% of SKUs) — tight control, weekly review, service level 98%+. B-items next 15% of value (~30% of SKUs) — periodic review. C-items last 5% of value (~50%+ of SKUs) — bulk policies, high safety margins, minimal attention. Effort should concentrate where money sits: one hour on an A-item beats a day on C-items.',
  },
  {
    id: 'k-xyz-analysis',
    title: 'XYZ Analysis (Demand Variability)',
    tags: ['forecasting', 'variability', 'classification'],
    content:
      'X = stable demand (CV < 0.5) — forecastable, low safety stock. Y = variable (CV 0.5–1.0) — seasonal/trendy, needs statistical safety stock. Z = erratic (CV > 1.0) — unpredictable; forecast per-order, hold buffer or make-to-order. Cross ABC×XYZ gives 9 cells; AZ items (high value + erratic) are the highest-risk cell needing human oversight, CX items (low value + steady) run best on automated min-max.',
  },
  {
    id: 'k-safety-stock',
    title: 'Safety Stock & Reorder Point',
    tags: ['replenishment', 'formula', 'planning'],
    content:
      'Safety stock = z × σd × √L (z=1.65 for 95% service level, σd=daily demand std-dev, L=lead time days). Reorder point = expected demand during lead time + safety stock = d̄L + SS. Supplier reliability below 90% multiplies effective L — unreliable suppliers silently inflate required buffers. Review σd quarterly: stale variability estimates mis-size buffers in both directions.',
  },
  {
    id: 'k-eoq',
    title: 'Economic Order Quantity',
    tags: ['ordering', 'cost', 'optimization'],
    content:
      'EOQ = √(2DS/H): D=annual demand units, S=fixed cost per order (~₹50–200 admin/logistics), H=holding cost per unit-year (~20–25% of unit price). EOQ balances ordering frequency against carrying cost. Caveats: assumes constant demand — cap order quantities at 4–8 weeks of supply for Z-grade (erratic) items even if EOQ says larger.',
  },
  {
    id: 'k-channel-stuffing',
    title: 'Channel Stuffing Risk Detection',
    tags: ['fraud', 'risk', 'orders'],
    content:
      'Channel stuffing = pushing excess primary sales into dealers near period-end to flatter revenue. Red flags in order data: abnormal order spikes in final week of month/quarter vs baseline, sudden new large orders from historically small dealers, order size > dealer trailing 60-day average × 3, followed by returns or order silence next period. Detect with EWMA z-score on daily order volume plus per-dealer spike ratio.',
  },
  {
    id: 'k-rfm-segmentation',
    title: 'RFM Customer Segmentation',
    tags: ['customers', 'segmentation', 'crm'],
    content:
      'Score each account 1–5 on Recency (days since last order), Frequency (order count), Monetary (total revenue). Segments: Champions (R≥4,F≥4), Loyal (F≥4), Potential Loyalist (R≥4,F 2–3), At Risk (R≤2,F≥3 — previously active, gone quiet), Hibernating (R≤2,F≤2), New (first order < 30 days). Action map: At Risk → win-back outreach within 7 days; Champions → volume pricing + first access; Hibernating → low-cost reactivation before write-off.',
  },
  {
    id: 'k-stock-cover',
    title: 'Stock Cover / Days of Inventory',
    tags: ['planning', 'kpi', 'inventory'],
    content:
      'Stock cover (days) = on-hand units ÷ average daily units sold. Target bands by velocity class: X-items 21–35 days, Y-items 14–28, Z-items ≤14 unless strategic. Cover above band ties up working capital; below band risks stockout within lead time. Portfolio-level: total inventory value ÷ daily COGS gives cash-days locked in inventory — the number finance cares about.',
  },
  {
    id: 'k-backorder-rate',
    title: 'Backorder Rate & Lost Demand',
    tags: ['service', 'kpi', 'orders'],
    content:
      'Backorder rate = orders (or lines) not fulfillable at request time ÷ total ordered. Each backordered line has ~10–15% probability of permanent order loss, higher for new dealers. Leading indicator: rising backorder rate on A-class SKUs predicts dealer churn 4–6 weeks ahead because dealers dual-source after two failed fills. Mitigate with SKU-level substitution rules and safety-stock prioritization by dealer OTIF history.',
  },
  {
    id: 'k-demand-forecasting-holtwinters',
    title: 'Demand Forecasting — Holt-Winters / ETS',
    tags: ['forecasting', 'statistics', 'method'],
    content:
      'Triple exponential smoothing (Holt-Winters) maintains three states: level (α), trend (β), seasonality (γ, weekly period=7 for daily retail data). Forecast = level + trend + seasonal index. Small α (0.1–0.3) smooths noise; β (0.05–0.2) tracks trend shifts; γ (0.05–0.2) adapts seasonal shape. Confidence falls with CV>1 and sparse history (<4 weeks) — report confidence scores alongside forecasts and fall back to moving-average for thin series.',
  },
  {
    id: 'k-ewma-anomaly-detection',
    title: 'EWMA Control Charts for Sales Anomalies',
    tags: ['anomaly', 'monitoring', 'statistics'],
    content:
      'EWMA smooths daily sales: s_t = λ·x_t + (1−λ)·s_{t−1} (λ≈0.3 responds fast, 0.1 is conservative). Control limits: s̄ ± k·σ_ewma (k=3 ≈ 99.7% confidence under normality). Breaches flag structural shifts vs noise: sustained upper breach = demand surge/channel stuffing; lower breach = churn signal or fulfillment failure. Always pair statistical alerts with context (promotions, holidays) before acting.',
  },
  {
    id: 'k-sku-velocity',
    title: 'SKU Velocity Tiers',
    tags: ['velocity', 'assortment', 'inventory'],
    content:
      'Classify by monthly units moved: Fast (>50), Medium (11–50), Slow (1–10), Dead (0 for 90+ days). Velocity drives everything downstream: slotting/warehouse location, cycle-count frequency, replenishment method (fast=automated min-max, medium=scheduled review, slow=event-driven), and assortment reviews — bottom-quartile velocity SKUs consuming prime warehouse space are first liquidation candidates.',
  },
  {
    id: 'k-trade-promotions',
    title: 'Trade Promotions & Elasticity Basics',
    tags: ['pricing', 'promotion', 'elasticity'],
    content:
      'Trade promotion = temporary price/discount to push channel volume. Measure lift = promo-period sales ÷ baseline forecast — anything under 1.2× rarely pays back the discount. Post-promo dip (0.5–2 weeks of depressed sales) is normal demand pull-forward, not lost demand. Price elasticity ε = %Δdemand ÷ %Δprice; |ε|<1 (inelastic) tolerates price increases, |ε|>1 rewards targeted discounts. Never discount X-class staples — margin loss outweighs volume gain.',
  },
  {
    id: 'k-distributor-economics',
    title: 'Distributor Margin Structure',
    tags: ['finance', 'channel', 'pricing'],
    content:
      'Typical FMCG chain: brand → distributor (+4–8% margin) → retailer (+15–25%) → consumer MRP. Distributor economics live on rotation, not margin: ROI = (margin% × annual turns). A 5% margin turning 24×/year beats 12% turning 4×. This is why slow-moving inventory kills dealer relationships — their capital sits dead. Offer slow movers with scheme support (buy-back guarantees, display bonuses) rather than raw discounts.',
  },
  {
    id: 'k-demand-sensing',
    title: 'Demand Sensing vs Statistical Forecast',
    tags: ['forecasting', 'signal', 'method'],
    content:
      'Statistical forecast (ETS/regression) sets the baseline from history. Demand sensing overlays short-term signals: recent order acceleration, web/feedback sentiment shifts, competitor stockouts reported by field staff. Practical rule: statistical model for weeks 2–13 horizon, sensing overrides for week 1 — the most recent 7 days of order flow predict next-week sales better than any long-run model.',
  },
  {
    id: 'k-inventory-kpis-summary',
    title: 'Core DMS KPI Dictionary',
    tags: ['kpi', 'reference', 'dashboard'],
    content:
      'Inventory accuracy = counted qty ÷ system qty (target ≥97%). Stock turnover = COGS ÷ avg inventory (annualized; 4–6× healthy FMCG). Fill rate target ≥97%, OTIF ≥95%. Backorder rate target <2%. Dead stock share of inventory value target <5%. Forecast accuracy (MAPE) target <25% at SKU-month level. Working capital in inventory = inventory value ÷ daily COGS (days). Review weekly at portfolio level, daily for A-class exceptions.',
  },
];
