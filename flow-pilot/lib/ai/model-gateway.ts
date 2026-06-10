import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

export type AiProvider = 'local' | 'gemini';

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

let geminiClient: GoogleGenerativeAI | null = null;

export function getAiProvider(): AiProvider {
  const provider = (process.env.AI_PROVIDER || 'local').toLowerCase();
  return provider === 'gemini' ? 'gemini' : 'local';
}

function getTaskModel(task: GenerateTextOptions['task']): string {
  if (getAiProvider() === 'gemini') {
    if (task === 'email_classification') return process.env.GEMINI_CLASSIFICATION_MODEL || 'gemini-2.5-flash';
    if (task === 'json_extraction') return process.env.GEMINI_EXTRACTION_MODEL || 'gemini-2.5-flash';
    return process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';
  }

  if (task === 'email_classification') return process.env.LOCAL_CLASSIFICATION_MODEL || process.env.LOCAL_LLM_MODEL || DEFAULT_LOCAL_MODEL;
  if (task === 'json_extraction') return process.env.LOCAL_EXTRACTION_MODEL || process.env.LOCAL_LLM_MODEL || DEFAULT_LOCAL_MODEL;
  return process.env.LOCAL_CHAT_MODEL || process.env.LOCAL_LLM_MODEL || DEFAULT_LOCAL_MODEL;
}

function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is required when AI_PROVIDER=gemini. Use AI_PROVIDER=local for a downloaded open-source model.');
  }

  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(apiKey);
  }

  return geminiClient;
}

async function generateWithGemini(options: GenerateTextOptions): Promise<string> {
  const model = getGeminiClient().getGenerativeModel({
    model: getTaskModel(options.task),
    systemInstruction: options.system,
    generationConfig: {
      temperature: options.temperature ?? 0.1,
      ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
    safetySettings: [
      {
        category: HarmCategory.HARM_CATEGORY_HARASSMENT,
        threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
      },
    ],
  });

  const result = await model.generateContent(options.prompt);
  return result.response.text().trim();
}

async function generateWithLocalModel(options: GenerateTextOptions): Promise<string> {
  const baseUrl = (process.env.LOCAL_LLM_BASE_URL || DEFAULT_LOCAL_BASE_URL).replace(/\/$/, '');
  const apiKey = process.env.LOCAL_LLM_API_KEY || 'ollama';
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
    throw new Error(`Local model request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json() as OpenAiCompatibleResponse;
  const content = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
  if (!content.trim()) {
    throw new Error('Local model returned an empty response');
  }

  return content.trim();
}

export async function generateText(options: GenerateTextOptions): Promise<string> {
  return getAiProvider() === 'gemini'
    ? generateWithGemini(options)
    : generateWithLocalModel(options);
}

export function getModelRuntimeSummary() {
  return {
    provider: getAiProvider(),
    classificationModel: getTaskModel('email_classification'),
    extractionModel: getTaskModel('json_extraction'),
    chatModel: getTaskModel('chatbot_answer'),
    localBaseUrl: process.env.LOCAL_LLM_BASE_URL || DEFAULT_LOCAL_BASE_URL,
  };
}
