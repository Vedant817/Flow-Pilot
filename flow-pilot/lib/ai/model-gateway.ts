export interface GenerateTextOptions {
  task: 'email_classification' | 'json_extraction' | 'chatbot_answer';
  system: string;
  prompt: string;
  temperature?: number;
  jsonMode?: boolean;
}

interface OpenAiCompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
    text?: string | null;
  }>;
}

const DEFAULT_LOCAL_BASE_URL = 'http://localhost:11434/v1';
const DEFAULT_LOCAL_MODEL = 'google/gemma-4-E4B-it';

function getTaskModel(task: GenerateTextOptions['task']): string {
  if (task === 'email_classification') return process.env.LOCAL_CLASSIFICATION_MODEL || process.env.LOCAL_LLM_MODEL || DEFAULT_LOCAL_MODEL;
  if (task === 'json_extraction') return process.env.LOCAL_EXTRACTION_MODEL || process.env.LOCAL_LLM_MODEL || DEFAULT_LOCAL_MODEL;
  return process.env.LOCAL_CHAT_MODEL || process.env.LOCAL_LLM_MODEL || DEFAULT_LOCAL_MODEL;
}

export async function generateText(options: GenerateTextOptions): Promise<string> {
  const baseUrl = (process.env.LOCAL_LLM_BASE_URL || DEFAULT_LOCAL_BASE_URL).replace(/\/$/, '');
  const apiKey = process.env.LOCAL_LLM_API_KEY || 'local-open-source-model';
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getTaskModel(options.task),
      messages: [
        { role: 'system', content: options.system },
        { role: 'user', content: options.prompt },
      ],
      temperature: options.temperature ?? 0.1,
      stream: false,
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'No response body');
    throw new Error(`Local Gemma model request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json() as OpenAiCompatibleResponse;
  const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
  if (!content.trim()) {
    throw new Error('Local Gemma model returned an empty response');
  }

  return content.trim();
}

export function getModelRuntimeSummary() {
  return {
    provider: 'local-open-source' as const,
    classificationModel: getTaskModel('email_classification'),
    extractionModel: getTaskModel('json_extraction'),
    chatModel: getTaskModel('chatbot_answer'),
    localBaseUrl: process.env.LOCAL_LLM_BASE_URL || DEFAULT_LOCAL_BASE_URL,
  };
}
