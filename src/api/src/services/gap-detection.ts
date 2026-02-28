import { getAllEntities } from './story-store.js';
import type { DecadeCoverage } from '../models/story.js';

const DECADES = ['1930s', '1940s', '1950s', '1960s', '1970s', '1980s', '1990s', '2000s', '2010s', '2020s'];

export function getDecadeCoverage(): DecadeCoverage[] {
  const entities = getAllEntities();
  const counts = new Map<string, number>();

  for (const decade of DECADES) {
    counts.set(decade, 0);
  }

  for (const entity of entities) {
    if (entity.decade && counts.has(entity.decade)) {
      counts.set(entity.decade, (counts.get(entity.decade) ?? 0) + 1);
    }
  }

  return DECADES.map((decade) => {
    const count = counts.get(decade) ?? 0;
    let status: DecadeCoverage['status'];
    if (count === 0) status = 'empty';
    else if (count <= 2) status = 'thin';
    else status = 'covered';

    return { decade, entityCount: count, status };
  });
}

export function analyzeGaps(): string[] {
  const coverage = getDecadeCoverage();
  // Gaps are empty + thin decades, sorted chronologically (already in order)
  return coverage
    .filter((d) => d.status === 'empty' || d.status === 'thin')
    .map((d) => d.decade);
}

export function buildGapHint(turnCount: number): string | null {
  // Only suggest gap questions at most once per 5 turns
  if (turnCount % 5 !== 0 || turnCount === 0) return null;

  const coverage = getDecadeCoverage();
  const emptyDecades = coverage.filter((d) => d.status === 'empty');
  const thinDecades = coverage.filter((d) => d.status === 'thin');

  // Prefer empty over thin, earlier over later
  const target = emptyDecades.length > 0 ? emptyDecades[0] : thinDecades[0];
  if (!target) return null;

  return `Die folgenden Jahrzehnte haben wenige oder keine Geschichten: ${target.decade} (${target.entityCount} Entitäten). Wenn es passt, frage sanft nach dieser Zeit. Formuliere die Frage warm, z.B.: "Du hast noch nicht viel über die ${target.decade} erzählt — wie war das Leben damals für dich?"`;
}
