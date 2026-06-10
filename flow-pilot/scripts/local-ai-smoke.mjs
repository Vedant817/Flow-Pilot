const baseUrl = (process.env.LOCAL_LLM_BASE_URL || 'http://localhost:11434/v1').replace(/\/$/, '');
const model = process.env.LOCAL_LLM_MODEL || 'flow-pilot-gemma4-lora';

try {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.LOCAL_LLM_API_KEY || 'ollama'}`,
    },
    body: JSON.stringify({
      model,
      stream: false,
      temperature: 0,
      messages: [
        { role: 'system', content: 'Return exactly: ok' },
        { role: 'user', content: 'Health check' },
      ],
    }),
  });

  if (!response.ok) {
    console.error(await response.text());
    process.exit(1);
  }

  const data = await response.json();
  console.log(data.choices?.[0]?.message?.content?.trim() || data);
} catch (error) {
  console.error(`Local model smoke check failed for ${model} at ${baseUrl}. Start an OpenAI-compatible local model server first (for example: vLLM/TGI/LM Studio/Ollama serving ${model}).`);
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
