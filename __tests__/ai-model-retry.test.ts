import { AutoModelForCausalLM, AutoTokenizer, pipeline, TextStreamer } from '@huggingface/transformers';
import { embedText } from '@/lib/ai/embeddings';
import { generateOnce } from '@/lib/ai/generator';

beforeEach(() => {
  global.__flowpilotLLM!.promise = null;
  global.__flowpilotEmbedder!.promise = null;
  jest.clearAllMocks();
});

test('embedding initialization shares failures, retries, then caches success', async () => {
  const load = pipeline as jest.Mock;
  const failure = new Error('runtime unavailable');
  load.mockRejectedValueOnce(failure).mockResolvedValueOnce(
    jest.fn().mockResolvedValue({ data: new Float32Array([3, 4]) })
  );
  const results = await Promise.allSettled([embedText('a'), embedText('b')]);
  expect(results).toEqual([
    { status: 'rejected', reason: failure },
    { status: 'rejected', reason: failure },
  ]);
  expect(load).toHaveBeenCalledTimes(1);
  expect(await Promise.all([embedText('a'), embedText('b')])).toEqual([[0.6, 0.8], [0.6, 0.8]]);
  await embedText('cached');
  expect(load).toHaveBeenCalledTimes(2);
});

test('generator initialization shares failures and retries successfully', async () => {
  const tokenizer = Object.assign(jest.fn(() => ({})), {
    apply_chat_template: jest.fn(() => 'prompt'),
  });
  const loadTokenizer = AutoTokenizer.from_pretrained as jest.Mock;
  const loadModel = AutoModelForCausalLM.from_pretrained as jest.Mock;
  const failure = new Error('runtime unavailable');
  loadTokenizer.mockResolvedValue(tokenizer);
  loadModel.mockRejectedValueOnce(failure).mockResolvedValueOnce({
    generate: jest.fn(async () => {
      const calls = (TextStreamer as jest.Mock).mock.calls;
      calls[calls.length - 1][1].callback_function('ok');
    }),
  });
  const results = await Promise.allSettled([generateOnce([]), generateOnce([])]);
  expect(results).toEqual([
    { status: 'rejected', reason: failure },
    { status: 'rejected', reason: failure },
  ]);
  expect(loadModel).toHaveBeenCalledTimes(1);
  expect(await Promise.all([generateOnce([]), generateOnce([])])).toEqual(['ok', 'ok']);
  await generateOnce([]);
  expect(loadModel).toHaveBeenCalledTimes(2);
  expect(loadTokenizer).toHaveBeenCalledTimes(2);
});
