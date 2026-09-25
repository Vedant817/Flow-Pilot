/* Local bake-off harness: A=current, B=quick-wins, E=prototype-centroid few-shot.
 * Reads scripts/eval/dataset.json, writes scripts/eval/preds/*.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { classifyEmail, heuristicClassifyEmail, type EmailClass } from '../../lib/nlp/classify';
import { embedText, cosineSimilarity } from '../../lib/ai/embeddings';
import { buildClassifyInput } from '../../lib/nlp/preprocess';

const DIR = join(process.cwd(), 'scripts', 'eval');
const DS = JSON.parse(readFileSync(join(DIR, 'dataset.json'), 'utf-8')) as {
  emails: Array<{ id: string; expected: EmailClass; style: string; subject: string; body: string }>;
};
mkdirSync(join(DIR, 'preds'), { recursive: true });

const inputB = (e: { subject: string; body: string }) => buildClassifyInput(e.body, e.subject);

const isTrain = (id: string) => Number(id.split('-')[1]) <= 8;

function norm(v: number[]): number[] {
  const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  return v.map((x) => x / n);
}

async function main() {
  await classifyEmail('warmup'); // model load, excluded from timing
  const out: Record<string, Record<string, { pred: string; ms: number }>> = {
    baseline: {}, quickwins: {}, proto: {},
  };

  // A: production path (trained head, subject + cleaned body)
  for (const e of DS.emails) {
    const t = performance.now();
    const pred = await classifyEmail(e.body, e.subject);
    out.baseline[e.id] = { pred, ms: performance.now() - t };
  }
  // B: heuristic on improved input (historical quick-wins reference)
  for (const e of DS.emails) {
    const t = performance.now();
    const pred = await heuristicClassifyEmail(inputB(e));
    out.quickwins[e.id] = { pred, ms: performance.now() - t };
  }

  // E: prototype-centroid few-shot on train-8/class (B-style input)
  const classes: EmailClass[] = ['new_order', 'update_order', 'feedback', 'other'];
  const centroids = new Map<EmailClass, number[]>();
  for (const c of classes) {
    const vecs = await Promise.all(
      DS.emails.filter((e) => e.expected === c && isTrain(e.id)).map((e) => embedText(inputB(e).slice(0, 1200)))
    );
    const mean = vecs[0].map((_, i) => vecs.reduce((a, v) => a + v[i], 0) / vecs.length);
    centroids.set(c, norm(mean));
  }
  // tune threshold on train
  const train = DS.emails.filter((e) => isTrain(e.id));
  let bestThr = 0, bestAcc = -1;
  const scoreOf = async (text: string) => {
    const v = await embedText(text.slice(0, 1200));
    let best: EmailClass = 'other', bestS = -2;
    for (const [c, cent] of centroids) {
      const s = cosineSimilarity(v, cent);
      if (s > bestS) { bestS = s; best = c; }
    }
    return { best, bestS };
  };
  const trainScores = await Promise.all(train.map(async (e) => ({ e, ...(await scoreOf(inputB(e))) })));
  for (let thr = 0; thr <= 0.9; thr += 0.05) {
    const acc = trainScores.filter((t) => (t.bestS >= thr ? t.best : 'other') === t.e.expected).length / trainScores.length;
    if (acc > bestAcc) { bestAcc = acc; bestThr = thr; }
  }
  console.log(`proto: tuned threshold=${bestThr.toFixed(2)} train-acc=${(bestAcc * 100).toFixed(1)}%`);
  for (const e of DS.emails) {
    const t = performance.now();
    const { best, bestS } = await scoreOf(inputB(e));
    out.proto[e.id] = { pred: bestS >= bestThr ? best : 'other', ms: performance.now() - t };
  }

  for (const [k, v] of Object.entries(out)) {
    writeFileSync(join(DIR, 'preds', `${k}.json`), JSON.stringify(v, null, 1));
    const ms = Object.values(v).map((r) => r.ms).sort((a, b) => a - b);
    console.log(`${k}: warm avg=${(ms.reduce((a, b) => a + b, 0) / ms.length).toFixed(1)}ms p50=${ms[Math.floor(ms.length / 2)].toFixed(1)}ms`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
