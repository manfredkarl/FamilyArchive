import { logger } from '../logger.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  maxTokens?: number;
  temperature?: number;
}

interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}

const FALLBACK_WELCOME_FIRST =
  'Hallo! Wie schön, dass Sie da sind. Ich bin Ihre KI-Begleiterin und würde so gerne Ihre Geschichten hören. Erzählen Sie mir doch — was ist Ihre früheste Erinnerung?';

const FALLBACK_WELCOME_RETURNING =
  'Schön, dass Sie wieder da sind! Ich freue mich, mehr von Ihren Geschichten zu hören. Woran möchten Sie heute anknüpfen?';

const FALLBACK_RESPONSES = [
  'Das klingt wunderbar! Erzählen Sie mir mehr darüber.',
  'Oh, wie interessant! Was ist dann passiert?',
  'Das muss eine besondere Zeit gewesen sein. Können Sie mir noch mehr davon erzählen?',
  'Vielen Dank fürs Teilen! Gibt es noch etwas, das Ihnen dazu einfällt?',
  'Das ist eine schöne Erinnerung. Was hat das für Sie bedeutet?',
];

const FALLBACK_SUMMARY =
  'Ein schönes Gespräch mit geteilten Erinnerungen und Geschichten aus vergangenen Zeiten.';

function getConfig(): AzureOpenAIConfig | null {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;

  if (!endpoint || !apiKey || !deployment) {
    return null;
  }

  return {
    endpoint: endpoint.replace(/\/$/, ''),
    apiKey,
    deployment,
    apiVersion: '2024-12-01-preview',
  };
}

export function isOpenAIConfigured(): boolean {
  return getConfig() !== null;
}

export function getFallbackWelcome(isFirstSession: boolean): string {
  return isFirstSession ? FALLBACK_WELCOME_FIRST : FALLBACK_WELCOME_RETURNING;
}

export function getFallbackResponse(): string {
  const idx = Math.floor(Math.random() * FALLBACK_RESPONSES.length);
  return FALLBACK_RESPONSES[idx];
}

export function getFallbackSummary(): string {
  return FALLBACK_SUMMARY;
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: ChatCompletionOptions = {},
): Promise<string> {
  const config = getConfig();
  if (!config) {
    throw new Error('Azure OpenAI is not configured');
  }

  const { maxTokens = 4096, temperature = 0.7 } = options;
  const url = `${config.endpoint}/openai/deployments/${config.deployment}/chat/completions?api-version=${config.apiVersion}`;

  const body = JSON.stringify({
    messages,
    max_tokens: maxTokens,
    temperature,
  });

  const maxRetries = 3;
  const backoffMs = [1000, 2000, 4000];

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': config.apiKey,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => 'Unknown error');
        logger.warn({ status: response.status, attempt, errText }, 'Azure OpenAI request failed');
        if (attempt < maxRetries - 1 && (response.status >= 500 || response.status === 429)) {
          await sleep(backoffMs[attempt]);
          continue;
        }
        throw new Error(`Azure OpenAI returned ${response.status}: ${errText}`);
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('Azure OpenAI returned empty response');
      }
      return content;
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'AbortError') {
        logger.warn({ attempt }, 'Azure OpenAI request timed out');
        if (attempt < maxRetries - 1) {
          await sleep(backoffMs[attempt]);
          continue;
        }
        throw new Error('Azure OpenAI request timed out after 30 seconds');
      }
      if (attempt < maxRetries - 1 && error.message?.includes('fetch')) {
        await sleep(backoffMs[attempt]);
        continue;
      }
      throw error;
    }
  }

  throw new Error('Azure OpenAI request failed after all retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
