import { chatCompletion, isOpenAIConfigured, type ChatMessage } from './openai-client.js';
import { getAllEntities, getAllSessions, getSessionMessages } from './story-store.js';
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
  if (!isOpenAIConfigured()) {
    return {
      answer: 'Der KI-Dienst ist nicht konfiguriert. Bitte versuchen Sie es später erneut.',
      sources: [],
    };
  }

  // Gather ALL stored data — let the LLM decide relevance
  const allEntities = getAllEntities();
  const allSessions = getAllSessions();
  const sources: SourceReference[] = [];

  // Build full story context from ALL sessions
  const storyLines: string[] = [];
  for (const session of allSessions) {
    const messages = getSessionMessages(session.id);
    const date = session.startedAt ? new Date(session.startedAt).toLocaleDateString('de-DE') : '';
    const userMsgs = messages.filter((m) => m.role === 'user');
    if (userMsgs.length === 0) continue;

    // Add session summary if available
    if (session.summary) {
      storyLines.push(`[Gespräch vom ${date}] Zusammenfassung: ${session.summary}`);
    }
    // Add Oma's actual words
    for (const msg of userMsgs) {
      storyLines.push(`[${date}] Oma: ${msg.content}`);
      sources.push({
        sessionId: session.id,
        sessionDate: session.startedAt ?? new Date().toISOString(),
        messageId: msg.id,
        excerpt: msg.content.substring(0, 200),
      });
    }
  }

  // Build entity summary
  const entitySummary = allEntities.length > 0
    ? allEntities.map((e) => `${e.name} (${e.type}${e.decade ? ', ' + e.decade : ''}): ${e.context}`).join('\n')
    : '(noch keine Entitäten extrahiert)';

  if (storyLines.length === 0) {
    return {
      answer: 'Es wurden noch keine Geschichten gesammelt. Starten Sie ein Gespräch mit Oma, um Erinnerungen zu bewahren!',
      sources: [],
    };
  }

  const systemContent = `${QUERY_PROMPT}

BEKANNTE PERSONEN, ORTE, EREIGNISSE:
${entitySummary}

ALLE GESCHICHTEN VON OMA:
${storyLines.join('\n')}

WICHTIG: Beantworte die Frage basierend auf ALLEM was Oma erzählt hat. Auch indirekte Bezüge und Zusammenhänge sind wertvoll. Antworte immer auf Deutsch.`;

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
