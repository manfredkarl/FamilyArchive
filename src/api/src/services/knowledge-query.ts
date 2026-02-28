import { chatCompletion, isOpenAIConfigured, type ChatMessage } from './openai-client.js';
import { searchEntities, getAllEntities, getSessionMessages, getSession } from './story-store.js';
import type { Entity } from '../models/story.js';
import { logger } from '../logger.js';

const QUERY_PROMPT = `You are answering a family member's question about their grandmother's ("Oma's") life stories. 
Use ONLY the information provided below from Oma's own conversations. Do not invent or assume facts.

If the provided information answers the question, compose a warm, narrative answer in German that weaves together Oma's own words and details. Reference specific stories naturally.

If the provided information does NOT contain relevant details, respond: "Dazu hat Oma leider noch nichts erzählt. Vielleicht können Sie sie beim nächsten Gespräch danach fragen!"`;

const STOP_WORDS = new Set(['was', 'wer', 'wo', 'wie', 'wann', 'warum', 'ist', 'hat', 'du', 'sie', 'er', 'es', 'ein', 'eine', 'der', 'die', 'das', 'den', 'dem', 'des', 'und', 'oder', 'aber', 'über', 'ueber', 'von', 'mit', 'für', 'fuer', 'zu', 'aus', 'bei', 'nach', 'vor', 'in', 'an', 'auf', 'weisst', 'weißt', 'kennst', 'erzähl', 'erzaehl', 'mir', 'mich', 'dich', 'sich', 'uns', 'euch', 'noch', 'schon', 'auch', 'nicht', 'kein', 'keine', 'etwas', 'alles', 'nichts', 'bitte', 'danke']);

/**
 * Search entities using keywords extracted from a natural language question.
 * Splits the question into words, filters stop words, then searches each word.
 */
function searchEntitiesForQuery(question: string): Entity[] {
  const words = question.toLowerCase().replace(/[?!.,;:]/g, '').split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  
  const allEnts = getAllEntities();
  const matched = new Map<string, Entity>();
  
  // Match entities whose name appears in the question (or vice versa)
  for (const entity of allEnts) {
    const eName = entity.name.toLowerCase();
    // Check if any query word matches entity name
    for (const word of words) {
      if (eName.includes(word) || word.includes(eName)) {
        matched.set(entity.id, entity);
        break;
      }
    }
    // Also check if entity context matches any keyword
    const eCtx = entity.context.toLowerCase();
    for (const word of words) {
      if (eCtx.includes(word)) {
        matched.set(entity.id, entity);
        break;
      }
    }
  }
  
  // If no keyword matches, also try the direct search as fallback
  if (matched.size === 0) {
    for (const word of words) {
      for (const e of searchEntities(word)) {
        matched.set(e.id, e);
      }
    }
  }
  
  return Array.from(matched.values());
}

export interface SourceReference {
  sessionId: string;
  sessionDate: string;
  messageId: string;
  excerpt: string;
}

export async function answerKnowledgeQuery(
  question: string,
): Promise<{ answer: string; sources: SourceReference[] }> {
  const matchedEntities = searchEntitiesForQuery(question);

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

  // Build prompt context — include ALL conversation messages for richer context
  const entitiesJson = JSON.stringify(
    matchedEntities.map((e) => ({ name: e.name, type: e.type, context: e.context, relationship: e.relationship, decade: e.decade })),
    null,
    2,
  );

  // Get all messages from sessions where entities were found
  const sessionIds = new Set(matchedEntities.flatMap((e) => e.sourceSessionIds));
  const allExcerpts: string[] = [];
  for (const sid of sessionIds) {
    const messages = getSessionMessages(sid);
    const session = getSession(sid);
    const date = session?.startedAt ? new Date(session.startedAt).toLocaleDateString('de-DE') : '';
    for (const msg of messages) {
      if (msg.role === 'user') {
        allExcerpts.push(`[${date}] Oma: ${msg.content}`);
      }
    }
  }

  const systemContent = `${QUERY_PROMPT}

EXTRACTED ENTITIES:
${entitiesJson}

OMA'S STORIES (from conversations):
${allExcerpts.join('\n') || '(keine Geschichten verfügbar)'}

IMPORTANT: Use the stories above to answer. Even brief mentions are valuable family memories to share.`;
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
