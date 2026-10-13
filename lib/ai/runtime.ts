export function withDeadline<T>(operation: Promise<T>, signal?: AbortSignal, timeoutMs = 45_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => finish(() => reject(new Error('AI operation aborted')));
    const timer = setTimeout(() => finish(() => reject(new Error('AI operation timed out'))), timeoutMs);
    let settled = false;
    function finish(apply: () => void) {
      if (settled) return; settled = true;
      clearTimeout(timer); signal?.removeEventListener('abort', abort); apply();
    }
    operation.then(value => finish(() => resolve(value)), error => finish(() => reject(error)));
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export function deadlineSignal(parent: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timer = setTimeout(abort, timeoutMs);
  if (parent?.aborted) abort(); else parent?.addEventListener('abort', abort, { once: true });
  return { signal: controller.signal, dispose: () => { clearTimeout(timer); parent?.removeEventListener('abort', abort); } };
}

/** Model instances are serialized; a full bounded queue rejects rather than growing memory. */
export class InferenceGate {
  private active = 0;
  private waiting: Array<() => void> = [];
  constructor(private readonly limit = 1, private readonly queueLimit = 8) {}
  async acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) throw new Error('Inference aborted');
    if (this.active >= this.limit) {
      if (this.waiting.length >= this.queueLimit) throw new Error('Inference capacity exhausted');
      await new Promise<void>((resolve, reject) => {
        const ready = () => { signal?.removeEventListener('abort', abort); resolve(); };
        const abort = () => {
          this.waiting = this.waiting.filter(value => value !== ready);
          reject(new Error('Queued inference aborted'));
        };
        signal?.addEventListener('abort', abort, { once: true });
        this.waiting.push(ready);
      });
    } else this.active += 1;
    let released = false;
    return () => {
      if (released) return; released = true;
      const next = this.waiting.shift();
      if (next) next(); else this.active -= 1;
    };
  }
  stats() { return { active: this.active, queued: this.waiting.length, capacity: this.limit, queueLimit: this.queueLimit }; }
}
