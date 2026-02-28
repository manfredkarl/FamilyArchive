import { chatCompletion, isOpenAIConfigured, type ChatMessage } from './openai-client.js';
import { searchEntities, getSessionMessages, getSession } from './story-store.js';
import { logger } from '../logger.js';

const QUERY_PROMPT = `You are answering a family member's question about their grandmother's ("Oma's") life stories. 
Use ONLY the information provided below from Oma's own conversations. Do not invent or assume facts.

If the provided information answers the question, compose a warm, narrative answer in German that weaves together Oma's own words and details. Reference specific stories naturally.

If the provided information does NOT contain relevant details, respond: "Dazu hat Oma leider noch nichts erzählt. Vielleicht können Sie sie beim nächsten Gespräch danach fragen!"`;

export interface SourceReference {
  sessionId: string;
  sessionDate: string;
  messageId: string;
  excerpt: string;
}

export async function answerKnowledgeQuery(
  question: string,
): Promise<{ answer: string; sources: SourceReference[] }> {
  const matchedEntities = searchEntities(question);

  if (matchedEntities.length === 0 && !isOpenAIConfigured()) {
    return {
      answer: 'Dazu hat Oma leider noch nichts erzählt. Vielleicht können Sie sie beim nächsten Gespräch danach fragen!',
      sources: [],
    };
  }

  // Collect source messages from matched entities
  const sources: SourceReference[] = [];
  const seenMessageIds = new Set<string>();

  for (const entity of matchedEntities) {
    for (let i = 0; i < entity.sourceSessionIds.length; i++) {
      const sessionId = entity.sourceSessionIds[i];
      const messageId = entity.sourceMessageIds[i];
      if (!messageId || seenMessageIds.has(messageId)) continue;
      seenMessageIds.add(messageId);

      const session = getSession(sessionId);
      const messages = getSessionMessages(sessionId);
      const msg = messages.find((m) => m.id === messageId);

      sources.push({
        sessionId,
        sessionDate: session?.startedAt ?? new Date().toISOString(),
        messageId,
        excerpt: msg ? msg.content.substring(0, 200) : '',
      });
    }
  }

  // Build prompt context
  const entitiesJson = JSON.stringify(
    matchedEntities.map((e) => ({ name: e.name, type: e.type, context: e.context, relationship: e.relationship, decade: e.decade })),
    null,
    2,
  );

  const sourceExcerpts = sources
    .map((s) => `[${s.sessionId}] ${s.excerpt}`)
    .join('\n');

  const systemContent = `${QUERY_PROMPT}

ENTITIES:
${entitiesJson}

SOURCE MESSAGES:
${sourceExcerpts || '(keine Quellen verfügbar)'}`;

  if (!isOpenAIConfigured()) {
    return {
      answer: 'Dazu hat Oma leider noch nichts erzählt. Vielleicht können Sie sie beim nächsten Gespräch danach fragen!',
      sources: [],
    };
  }

  try {
    const promptMessages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      { role: 'user', content: question },
    ];

    const answer = await chatCompletion(promptMessages, { maxTokens: 1000, temperature: 0.5 });
    return { answer, sources };
  } catch (err) {
    logger.error({ err }, 'Knowledge query failed');
    throw new Error('AI service is currently unavailable. Please try again.');
  }
}
