import { embedText, cosineSimilarity } from './embeddings';
import { hybridRetrieve, type RetrievedDoc } from './retriever';
import { generate, type ChatMessage } from './generator';
import {
  toolOrdersOverview,
  toolRevenueSeries,
  toolTopProducts,
  toolLowStock,
  toolCustomerProfile,
  toolInventoryValue,
  toolDealerNetwork,
  toolSchemeEligibility,
  toolCouponLookup,
  toolSchemeAnalytics,
  type ToolResult,
  type ToolContext,
} from './tools';

/**
 * Copilot orchestration.
 *
 * Architecture: semantic intent router → deterministic tool calls →
 * retrieval-augmented generation with a small local model.
 *
 * The tiny on-device model never decides *what* to compute — an embedding
 * classifier routes the query to typed tools whose outputs are injected as
 * structured facts. The model's only job is composing a fluent answer over
 * verified data, which keeps a 360M-parameter model reliable in production.
 */

type Intent = 'orders_overview' | 'revenue_trend' | 'top_products' | 'low_stock' | 'customer_lookup' | 'inventory_value' | 'dealer_network' | 'scheme_lookup' | 'general';

const INTENT_EXEMPLARS: Record<Exclude<Intent, 'general'>, string[]> = {
  orders_overview: [
    'how many orders today', 'order status summary', 'pending fulfilled canceled orders',
    'recent order volume', 'show me order counts', 'how are orders looking this week',
  ],
  revenue_trend: [
    'sales trend', 'revenue this month', 'week over week sales change', 'units sold last 30 days',
    'is demand growing', 'sales going up or down', 'daily sales numbers',
  ],
  top_products: [
    'best selling products', 'top products by units', 'which products sell most',
    'fastest moving skus', 'product performance ranking', 'what is trending',
  ],
  low_stock: [
    'low stock items', 'products below alert level', 'what needs restocking',
    'inventory running out', 'stock alerts', 'reorder recommendations',
  ],
  customer_lookup: [
    'find customer', 'customer order history for',
    'lookup account by email', 'orders placed by',
  ],
  inventory_value: [
    'total inventory value', 'how much stock worth', 'warehouse value',
    'total units in stock', 'sku count', 'capital tied in inventory',
  ],
  dealer_network: [
    'dealer network performance and account health', 'which dealers are high risk or over credit limit',
    'territory sales performance', 'credit exposure and overdue accounts',
    'dealer returns and service levels', 'which country territory is strongest',
  ],
  scheme_lookup: [
    'eligible for loyalty discount', 'qualify for free setup', 'at-risk winback coupon',
    'my promotion code', 'scheme redemption rate', 'regular cadence customers',
    'slipping customers', 'dormant tenured', 'holdout lift', 'promotion ROI',
    'coupon by code', 'which promotion am I eligible for',
  ],
};

interface RouterCache {
  exemplarVectors: Map<Intent, number[][]> | null;
}

declare global {
  var __flowpilotRouter: RouterCache | undefined;
}
const routerCache: RouterCache = global.__flowpilotRouter ?? (global.__flowpilotRouter = { exemplarVectors: null });

const THRESHOLDS: Record<Intent, number> = {
  orders_overview: 0.42,
  revenue_trend: 0.42,
  top_products: 0.42,
  low_stock: 0.42,
  customer_lookup: 0.42,
  inventory_value: 0.42,
  dealer_network: 0.45,
  scheme_lookup: 0.55,
  general: 0.42,
};

async function routeIntent(queryEmbedding: number[]): Promise<Intent> {
  if (!routerCache.exemplarVectors) {
    const map = new Map<Intent, number[][]>();
    for (const [intent, examples] of Object.entries(INTENT_EXEMPLARS)) {
      const vectors = await Promise.all(examples.map(embedText));
      map.set(intent as Intent, vectors);
    }
    routerCache.exemplarVectors = map;
  }

  let best: Intent = 'general';
  let bestScore = THRESHOLDS.general;
  for (const [intent, vectors] of routerCache.exemplarVectors) {
    const threshold = THRESHOLDS[intent as Intent] ?? 0.42;
    const max = Math.max(...vectors.map((v) => cosineSimilarity(queryEmbedding, v)));
    if (max > threshold && max > bestScore) {
      bestScore = max;
      best = intent;
    }
  }
  return best;
}

const TOOL_BY_INTENT: Partial<Record<Intent, (context: ToolContext) => Promise<ToolResult>>> = {
  orders_overview: (context) => toolOrdersOverview(context, 30),
  revenue_trend: (context) => toolRevenueSeries(context, 30),
  top_products: (context) => toolTopProducts(context, 30),
  low_stock: (context) => toolLowStock(context),
  inventory_value: (context) => toolInventoryValue(context),
  dealer_network: (context) => toolDealerNetwork(context),
  scheme_lookup: (context) => toolSchemeAnalytics(context),
};

export interface CopilotContext {
  sources: RetrievedDoc[];
  facts: ToolResult[];
  intent: Intent;
}

export async function buildContext(query: string, toolContext: ToolContext): Promise<CopilotContext> {
  const queryVec = await embedText(query);
  const intent = await routeIntent(queryVec);

  const [sources, toolResult] = await Promise.all([
    intent === 'scheme_lookup' ? Promise.resolve([] as any) : hybridRetrieve(query, { limit: 6, orgId: toolContext.orgId }),
    TOOL_BY_INTENT[intent]?.(toolContext).catch(() => null) ?? Promise.resolve(null),
  ]);

  const facts: ToolResult[] = [];
  // Scheme lookup: single code lookup if coupon code present
  if (intent === 'scheme_lookup') {
    const codeMatch = query.match(/\b([A-Z0-9]{3,}-[A-Z0-9]{4,})\b/i);
    if (codeMatch) {
      facts.push(await toolCouponLookup(toolContext, codeMatch[1].trim()).catch(() => null as never));
    }
    const emailMatch = query.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (emailMatch) {
      facts.push(await toolSchemeEligibility(toolContext, emailMatch[0].trim()).catch(() => null as never));
    } else if (/\b(eligible|loyal|promotion|coupon|winback|holdout)\b/i.test(query) && !codeMatch) {
      // try to extract trailing name-ish term
      const m = query.match(/(?:for|of|by)\s+([A-Z][\w\s]{2,30})/i);
      if (m) facts.push(await toolSchemeEligibility(toolContext, m[1].trim()).catch(() => null as never));
    }
  } else {
    if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(query) || /\b(customer|dealer|account)\b/i.test(query)) {
      const m = query.match(/([\w.+-]+@[\w-]+\.[\w.]+)/) ?? query.match(/(?:about|for|of|by)\s+([A-Z][\w\s]{2,30})/i);
      if (m) {
        facts.push(await toolCustomerProfile(toolContext, m[1].trim()).catch(() => null as never));
      } else if (intent === 'customer_lookup') {
        facts.push(await toolCustomerProfile(toolContext, query.replace(/[^\w\s]/g, '').split(/\s+/).slice(-3).join(' ') || 'a').catch(() => null as never));
      }
    }
  }
  if (toolResult) facts.push(toolResult);

  return { sources, facts: facts.filter(Boolean), intent };
}

function formatContext(ctx: CopilotContext): string {
  const parts: string[] = [];

  ctx.facts.forEach((f, i) => {
    parts.push(`[F${i + 1}] ${f.tool}: ${f.summary}\nDATA: ${JSON.stringify(f.facts).slice(0, 600)}`);
  });

  ctx.sources.forEach((s, i) => {
    parts.push(`[S${i + 1}] (${s.kind}) ${s.title}: ${s.text.slice(0, 500)}`);
  });

  return parts.join('\n\n');
}

const SYSTEM_PROMPT = `You are Flow Pilot Copilot, an operations analyst for a distribution business.
Rules:
1. Answer ONLY from the CONTEXT provided. If it lacks the answer, say so plainly.
2. Cite sources inline like [S1] or [F2] when using them.
3. Lead with the direct answer, then one short supporting insight. No preamble.
4. Use ₹ and Indian numbering conventions where relevant.
5. Be concise: max ~120 words unless listing data.
6. For promotion queries, cite [F1] lift numbers; if no promotions found, say "No promotions found — check /promotions" and never fabricate a code.`;

export async function* streamCopilotResponse(
  query: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  toolContext: ToolContext
): AsyncGenerator<{ type: 'meta'; payload: CopilotContext } | { type: 'token'; payload: string }> {
  const ctx = await buildContext(query, toolContext);
  yield { type: 'meta', payload: ctx };

  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-6).map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    {
      role: 'user',
      content: `CONTEXT:\n${formatContext(ctx)}\n\nQUESTION: ${query}`,
    },
  ];

  for await (const token of generate(messages, { maxNewTokens: 300, temperature: 0.15 })) {
    yield { type: 'token', payload: token };
  }
}

export async function getCopilotResponse(
  query: string,
  history: { role: 'user' | 'assistant'; content: string }[],
  toolContext: ToolContext
): Promise<{ response: string; context: CopilotContext }> {
  let response = '';
  let context: CopilotContext | null = null;

  for await (const event of streamCopilotResponse(query, history, toolContext)) {
    if (event.type === 'token') response += event.payload;
    else context = event.payload;
  }

  return { response: response.trim(), context: context! };
}
