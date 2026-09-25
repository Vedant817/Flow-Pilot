/* Scores all preds/*.json against dataset.json. Usage: npx tsx scripts/eval/score.ts */
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';

const DIR = join(process.cwd(), 'scripts', 'eval');
const DS = JSON.parse(readFileSync(join(DIR, 'dataset.json'), 'utf-8')) as {
  emails: Array<{ id: string; expected: string; style: string }>;
};
const CLASSES = ['new_order', 'update_order', 'feedback', 'other'];
const isTrain = (id: string) => Number(id.split('-')[1]) <= 8;

for (const f of readdirSync(join(DIR, 'preds')).filter((x) => x.endsWith('.json'))) {
  const sys = f.replace('.json', '');
  const preds = JSON.parse(readFileSync(join(DIR, 'preds', f), 'utf-8')) as Record<string, { pred: string; ms: number; conf?: number }>;
  const rows = DS.emails.map((e) => ({ ...e, pred: preds[e.id]?.pred ?? '__MISSING__', ms: preds[e.id]?.ms ?? 0 }));
  const acc = (rs: typeof rows) => rs.filter((r) => r.pred === r.expected).length / rs.length;
  const heldout = rows.filter((r) => !isTrain(r.id));
  console.log(`\n### ${sys}: full-acc=${(acc(rows) * 100).toFixed(1)}% heldout-acc=${(acc(heldout) * 100).toFixed(1)}% (n=${rows.length}/${heldout.length})`);
  for (const c of CLASSES) {
    const tp = rows.filter((r) => r.pred === c && r.expected === c).length;
    const fp = rows.filter((r) => r.pred === c && r.expected !== c).length;
    const fn = rows.filter((r) => r.pred !== c && r.expected === c).length;
    const p = tp + fp ? tp / (tp + fp) : 0, r = tp + fn ? tp / (tp + fn) : 0;
    console.log(`  ${c}: P=${(p * 100).toFixed(0)}% R=${(r * 100).toFixed(0)}% F1=${((2 * p * r) / (p + r || 1) * 100).toFixed(0)}%`);
  }
  const misses = rows.filter((r) => r.pred !== r.expected);
  console.log(`  misses (${misses.length}): ` + misses.map((m) => `${m.id}[${m.expected}->${m.pred}]`).join(' '));
  const ms = rows.map((r) => r.ms).sort((a, b) => a - b);
  console.log(`  latency avg=${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1)}ms p50=${ms[Math.floor(ms.length / 2)].toFixed(1)}ms`);
}
