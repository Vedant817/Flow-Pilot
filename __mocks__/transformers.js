const vector = new Float32Array(384).fill(1 / Math.sqrt(384));

module.exports = {
  env: {},
  pipeline: jest.fn(async () => async () => ({ data: vector })),
  AutoTokenizer: { from_pretrained: jest.fn() },
  AutoModelForCausalLM: { from_pretrained: jest.fn() },
  TextStreamer: jest.fn(),
  StoppingCriteriaList: class { push() {} },
  InterruptableStoppingCriteria: class { interrupt() {} },
};
