import { InferenceGate, withDeadline } from '../lib/ai/runtime';
test('bounded inference queue serializes work and rejects overload', async () => {
  const gate = new InferenceGate(1, 1);
  const release = await gate.acquire();
  const queued = gate.acquire();
  await expect(gate.acquire()).rejects.toThrow('capacity exhausted');
  expect(gate.stats()).toMatchObject({ active: 1, queued: 1 });
  release();
  const releaseQueued = await queued;
  releaseQueued();
  expect(gate.stats()).toMatchObject({ active: 0, queued: 0 });
});
test('canceling queued work removes it from capacity accounting', async () => {
  const gate = new InferenceGate(1, 1);
  const release = await gate.acquire();
  const controller = new AbortController();
  const queued = gate.acquire(controller.signal);
  controller.abort();
  await expect(queued).rejects.toThrow('aborted');
  release();
  expect(gate.stats().queued).toBe(0);
});
test('operation deadline rejects even if a provider never settles', async () => {
  jest.useFakeTimers();
  const promise = withDeadline(new Promise(() => {}), undefined, 100);
  const assertion = expect(promise).rejects.toThrow('timed out');
  jest.advanceTimersByTime(101);
  await assertion;
  jest.useRealTimers();
});
