import {
  chatCompletion,
  isOpenAIConfigured,
  getFallbackWelcome,
  getFallbackResponse,
  getFallbackSummary,
  type ChatMessage,
} from './openai-client.js';
import { getSessionMessages, getAllSessions, addMessage, getAllEntities } from './story-store.js';
import { extractEntities } from './entity-extraction.js';
import { buildGapHint } from './gap-detection.js';
import type { StoryMessage } from '../models/story.js';
import { logger } from '../logger.js';

const PERSONALITY_PROMPT = `Du bist eine warmherzige, geduldige KI-Begleiterin, die Oma dabei hilft, ihre Lebensgeschichten zu erzählen und zu bewahren. 

Deine Regeln:
- Sprich immer auf Deutsch, in einem warmen, respektvollen Ton.
- Höre aufmerksam zu und zeige echtes Interesse an jeder Geschichte.
- Stelle sanfte Nachfragen, um mehr Details zu erfahren (Wer? Wo? Wann? Wie hat sich das angefühlt?).
- Unterbreche niemals — lass Oma in ihrem eigenen Tempo erzählen.
- Fasse gelegentlich zusammen, was du gehört hast, um zu zeigen, dass du zuhörst.
- Wenn Oma abschweift, bringe sie sanft zum Thema zurück.
- Sei komfortabel mit Stille — nicht jede Pause braucht eine Antwort.
- Halte deine Antworten kurz und herzlich (2-4 Sätze).`;

const SUMMARY_PROMPT = `Fasse dieses Gespräch in 2-3 Sätzen auf Deutsch zusammen. Hebe die wichtigsten Geschichten, Personen, Orte und Zeiträume hervor, die besprochen wurden.`;

// Rough estimate: 1 token ≈ 4 characters for German text
const CHARS_PER_TOKEN = 4;
const MAX_SUMMARY_TOKENS = 20000;
const MAX_TRANSCRIPT_TOKENS = 80000;
const MAX_SUMMARY_CHARS = MAX_SUMMARY_TOKENS * CHARS_PER_TOKEN;
const MAX_TRANSCRIPT_CHARS = MAX_TRANSCRIPT_TOKENS * CHARS_PER_TOKEN;

export function buildSystemPrompt(
  previousSummaries: string[],
  currentTranscript: StoryMessage[],
  turnCount?: number,
): ChatMessage[] {
  const messages: ChatMessage[] = [];

  // 1. Personality instructions
  messages.push({ role: 'system', content: PERSONALITY_PROMPT });

  // 2. Entity context
  const allEntities = getAllEntities();
  if (allEntities.length > 0) {
    const entitySummary = allEntities
      .slice(0, 30)
      .map((e) => `- ${e.name} (${e.type}): ${e.context}`)
      .join('\n');
    messages.push({
      role: 'system',
      content: `Bekannte Entitäten aus bisherigen Gesprächen:\n${entitySummary}`,
    });
  }

  // 3. Gap hints (at most once per 5 turns)
  if (turnCount !== undefined) {
    const gapHint = buildGapHint(turnCount);
    if (gapHint) {
      messages.push({ role: 'system', content: gapHint });
    }
  }

  // 4. Previous session summaries (trimmed if over budget)
  if (previousSummaries.length > 0) {
    let summariesText = previousSummaries
      .map((s, i) => `Gespräch ${i + 1}: ${s}`)
      .join('\n');

    // Trim oldest summaries if over budget
    while (summariesText.length > MAX_SUMMARY_CHARS && previousSummaries.length > 1) {
      previousSummaries.shift();
      summariesText = previousSummaries
        .map((s, i) => `Gespräch ${i + 1}: ${s}`)
        .join('\n');
    }

    messages.push({
      role: 'system',
      content: `Bisherige Gespräche:\n${summariesText}`,
    });
  }

  // 3. Current session transcript
  const transcriptMessages: ChatMessage[] = [];
  let totalChars = 0;

  // Add messages from newest to oldest, then reverse
  for (let i = currentTranscript.length - 1; i >= 0; i--) {
    const msg = currentTranscript[i];
    if (totalChars + msg.content.length > MAX_TRANSCRIPT_CHARS) break;
    totalChars += msg.content.length;
    transcriptMessages.unshift({
      role: msg.role,
      content: msg.content,
    });
  }

  messages.push(...transcriptMessages);

  return messages;
}

export async function generateWelcome(
  isFirstSession: boolean,
  previousSummaries: string[],
): Promise<string> {
  if (!isOpenAIConfigured()) {
    return getFallbackWelcome(isFirstSession);
  }

  const systemMessages: ChatMessage[] = [
    { role: 'system', content: PERSONALITY_PROMPT },
  ];

  if (previousSummaries.length > 0) {
    const summariesText = previousSummaries
      .map((s, i) => `Gespräch ${i + 1}: ${s}`)
      .join('\n');
    systemMessages.push({
      role: 'system',
      content: `Bisherige Gespräche:\n${summariesText}`,
    });
  }

  if (isFirstSession) {
    systemMessages.push({
      role: 'system',
      content: 'Dies ist das allererste Gespräch. Begrüße Oma herzlich und stelle eine offene Einstiegsfrage.',
    });
  } else {
    systemMessages.push({
      role: 'system',
      content: 'Oma kommt zurück für ein weiteres Gespräch. Begrüße sie herzlich und beziehe dich auf frühere Gespräche.',
    });
  }

  try {
    return await chatCompletion(systemMessages, { maxTokens: 300, temperature: 0.8 });
  } catch {
    return getFallbackWelcome(isFirstSession);
  }
}

export async function handleConversationTurn(
  sessionId: string,
  userMessage: string,
): Promise<string> {
  // Store user message
  const userMsg = addMessage(sessionId, 'user', userMessage);

  if (!isOpenAIConfigured()) {
    const response = getFallbackResponse();
    addMessage(sessionId, 'assistant', response);
    return response;
  }

  // Get session context
  const allSessions = getAllSessions();
  const previousSummaries = allSessions
    .filter((s) => s.id !== sessionId && s.status === 'ended' && s.summary)
    .map((s) => s.summary as string);

  const currentMessages = getSessionMessages(sessionId);
  // Turn count = number of user messages in this session
  const turnCount = currentMessages.filter((m) => m.role === 'user').length;

  const prompt = buildSystemPrompt(previousSummaries, currentMessages, turnCount);

  try {
    const response = await chatCompletion(prompt, { maxTokens: 500, temperature: 0.7 });
    addMessage(sessionId, 'assistant', response);

    // Fire entity extraction asynchronously (don't await)
    extractEntities(userMessage, userMsg.id, sessionId).catch((err) => {
      logger.error({ err }, 'Async entity extraction failed');
    });

    return response;
  } catch {
    throw new Error('AI service is currently unavailable. Please try again.');
  }
}

export async function generateSessionSummary(
  sessionId: string,
): Promise<string> {
  const messages = getSessionMessages(sessionId);

  if (!isOpenAIConfigured()) {
    if (messages.length <= 1) {
      return 'Kurzes Gespräch ohne geteilte Geschichten.';
    }
    return getFallbackSummary();
  }

  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'Oma' : 'KI'}: ${m.content}`)
    .join('\n');

  const promptMessages: ChatMessage[] = [
    { role: 'system', content: SUMMARY_PROMPT },
    { role: 'user', content: transcript },
  ];

  try {
    return await chatCompletion(promptMessages, { maxTokens: 300, temperature: 0.3 });
  } catch {
    return getFallbackSummary();
  }
}

export async function startNewSession(): Promise<{
  sessionId: string;
  welcomeMessage: string;
}> {
  const { createSession } = await import('./story-store.js');

  const allSessions = getAllSessions();
  const isFirstSession = allSessions.length === 0;
  const previousSummaries = allSessions
    .filter((s) => s.status === 'ended' && s.summary)
    .map((s) => s.summary as string);

  const session = createSession();
  const welcomeMessage = await generateWelcome(isFirstSession, previousSummaries);

  addMessage(session.id, 'assistant', welcomeMessage);

  return {
    sessionId: session.id,
    welcomeMessage,
  };
}

export function getLastSessionSummary(): string | null {
  const sessions = getAllSessions();
  const lastEnded = sessions.find((s) => s.status === 'ended' && s.summary);
  return lastEnded?.summary ?? null;
}
