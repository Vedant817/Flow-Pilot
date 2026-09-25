/* Embed all 80 dataset mails with the LOCALLY exported fine-tuned encoder.
 * Writes scripts/eval/node-vectors.json */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { pipeline } from '@huggingface/transformers';

const DIR = join(process.cwd(), 'scripts', 'eval');
const DS = JSON.parse(readFileSync(join(DIR, 'dataset.json'), 'utf-8')) as {
  emails: Array<{ id: string; subject: string; body: string }>;
};

function norm(a: number[]): number[] {
  const n = Math.sqrt(a.reduce((s, x) => s + x * x, 0)) || 1;
  return a.map((x) => x / n);
}

async function main() {
  const modelDir = process.argv[2] ?? join(DIR, 'local-model');
  const outName = process.argv[3] ?? 'node-vectors.json';
  const dtype = process.argv[4] ?? 'fp32';
  const t0 = Date.now();
  const pipe = await pipeline('feature-extraction', modelDir, { dtype: dtype as 'fp32' });
  console.log(`local model load: ${Date.now() - t0}ms`);
  const out: Record<string, number[]> = {};
  const t1 = Date.now();
  for (const e of DS.emails) {
    const r = await pipe(`${e.subject}\n${e.body}`.slice(0, 1200), { pooling: 'mean', normalize: false });
    out[e.id] = norm(Array.from(r.data as Float32Array));
  }
  console.log(`embedded ${DS.emails.length} mails in ${Date.now() - t1}ms (avg ${((Date.now() - t1) / DS.emails.length).toFixed(1)}ms)`);
  writeFileSync(join(DIR, outName), JSON.stringify(out));
  console.log(`wrote ${outName}, dim=`, out[DS.emails[0].id].length);
}

main().catch((e) => { console.error(e); process.exit(1); });
