export const MODEL_MANIFEST = {
  generator: { id: 'HuggingFaceTB/SmolLM2-360M-Instruct', revision: 'a10cc1512eabd3dde888204e902eca88bddb4951', dtype: 'q4' as const },
  embeddings: { id: 'Xenova/all-MiniLM-L6-v2', revision: '751bff37182d3f1213fa05d7196b954e230abad9', dtype: 'q8' as const },
};
export function pinnedRevision(modelId: string, revision: string | undefined, baseline: { id: string; revision: string }) {
  const selected = revision || (modelId === baseline.id ? baseline.revision : '');
  if (!/^[a-f0-9]{40}$/.test(selected)) throw new Error('Custom model artifacts require an explicit immutable revision');
  return selected;
}
