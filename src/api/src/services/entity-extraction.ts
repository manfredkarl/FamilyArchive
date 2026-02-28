import { chatCompletion, isOpenAIConfigured, type ChatMessage } from './openai-client.js';
import { addEntities } from './story-store.js';
import type { Entity } from '../models/story.js';
import { logger } from '../logger.js';

const EXTRACTION_PROMPT = `You are an entity extraction system for a family story preservation app. 
Extract entities from the following message spoken by an elderly person sharing family memories.

For each entity, provide:
- name: The entity name (person's name, place name, year, or event description)
- type: One of "person", "year", "place", "event"
- context: A brief description of how this entity relates to the story (1-2 sentences)
- relationship: For persons only — their relationship to the speaker (e.g., "Bruder", "Tochter", "Nachbar"). Null for non-person entities.
- decade: The decade this entity relates to (e.g., "1960s"). Infer from explicit years or contextual clues. Use null if no decade can be inferred.

Return a JSON array. If no entities are found, return an empty array [].
Do not invent entities. Only extract what is explicitly stated or clearly implied.`;

const VALID_TYPES = new Set(['person', 'year', 'place', 'event']);
const DECADE_PATTERN = /^\d{4}s$/;

interface RawEntity {
  name?: string;
  type?: string;
  context?: string;
  relationship?: string | null;
  decade?: string | null;
}

export async function extractEntities(
  messageContent: string,
  messageId: string,
  sessionId: string,
): Promise<Entity[]> {
  if (!isOpenAIConfigured()) {
    return [];
  }

  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: EXTRACTION_PROMPT },
      { role: 'user', content: messageContent },
    ];

    const response = await chatCompletion(messages, { maxTokens: 2000, temperature: 0.3 });

    if (!response) return [];

    // Parse JSON from response — handle markdown code blocks
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }

    let rawEntities: RawEntity[];
    try {
      rawEntities = JSON.parse(jsonStr);
    } catch {
      logger.error({ response: jsonStr.substring(0, 200) }, 'Entity extraction returned non-JSON');
      return [];
    }

    if (!Array.isArray(rawEntities)) {
      logger.error('Entity extraction returned non-array');
      return [];
    }

    const now = new Date().toISOString();
    const entities: Entity[] = [];

    for (const raw of rawEntities) {
      if (!raw.name || !raw.name.trim() || !raw.type) continue;
      if (!VALID_TYPES.has(raw.type)) {
        logger.warn({ type: raw.type }, 'Invalid entity type, discarding');
        continue;
      }

      const decade = raw.decade && DECADE_PATTERN.test(raw.decade) ? raw.decade : null;

      entities.push({
        id: `ent_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        name: raw.name.trim(),
        type: raw.type as Entity['type'],
        context: raw.context || '',
        relationship: raw.type === 'person' ? (raw.relationship || null) : null,
        decade,
        sourceMessageIds: [messageId],
        sourceSessionIds: [sessionId],
        createdAt: now,
        updatedAt: now,
      });
    }

    if (entities.length > 0) {
      addEntities(entities);
    }

    return entities;
  } catch (err) {
    logger.error({ err }, 'Entity extraction failed');
    return [];
  }
}
