'use client';

import { useState, useEffect, useCallback } from 'react';

interface DecadeCoverage {
  decade: string;
  entityCount: number;
  status: 'empty' | 'thin' | 'covered';
}

interface Entity {
  id: string;
  name: string;
  type: 'person' | 'year' | 'place' | 'event';
  context: string;
  decade: string | null;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const STATUS_COLORS: Record<string, { bg: string; border: string; label: string }> = {
  covered: { bg: '#D1FAE5', border: '#059669', label: 'gut erzählt' },
  thin: { bg: '#FEF3C7', border: '#D97706', label: 'wenig erzählt' },
  empty: { bg: '#F3F4F6', border: '#9CA3AF', label: 'noch nichts' },
};

const ENTITY_TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  person: { bg: '#DBEAFE', text: '#1E40AF' },
  place: { bg: '#D1FAE5', text: '#065F46' },
  year: { bg: '#FEF3C7', text: '#92400E' },
  event: { bg: '#EDE9FE', text: '#5B21B6' },
};

const ENTITY_TYPE_EMOJI: Record<string, string> = {
  person: '👤',
  place: '📍',
  year: '📆',
  event: '⭐',
};

export default function TimelinePage() {
  const [decades, setDecades] = useState<DecadeCoverage[]>([]);
  const [selectedDecade, setSelectedDecade] = useState<string | null>(null);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCoverage = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/stories/coverage`);
      if (res.ok) {
        const data = await res.json();
        setDecades(data.decades);
      }
    } catch {
      setError('Fehler beim Laden der Zeitstrahl-Daten.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCoverage();
  }, [fetchCoverage]);

  const handleDecadeClick = async (decade: string) => {
    if (selectedDecade === decade) {
      setSelectedDecade(null);
      setEntities([]);
      return;
    }
    setSelectedDecade(decade);
    try {
      const res = await fetch(`${API_BASE}/api/stories/entities?decade=${decade}`);
      if (res.ok) {
        const data = await res.json();
        setEntities(data.entities);
      }
    } catch {
      setEntities([]);
    }
  };

  if (isLoading) {
    return (
      <main
        className="flex flex-col items-center justify-center"
        style={{ backgroundColor: '#FFFBEB', minHeight: 'calc(100vh - 64px)', color: '#451A03' }}
      >
        <p style={{ fontSize: '18px' }}>⏳ Lade Zeitstrahl...</p>
      </main>
    );
  }

  return (
    <main
      className="flex flex-col items-center px-6"
      style={{
        backgroundColor: '#FFFBEB',
        minHeight: 'calc(100vh - 64px)',
        paddingTop: '32px',
        maxWidth: '1000px',
        margin: '0 auto',
      }}
    >
      <h1
        style={{
          fontFamily: "Georgia, 'Times New Roman', Palatino, serif",
          fontSize: '30px',
          fontWeight: 700,
          color: '#451A03',
          marginBottom: '8px',
        }}
      >
        📅 Zeitstrahl
      </h1>
      <p style={{ fontSize: '20px', color: '#78350F', marginBottom: '24px' }}>
        Omas Jahrzehnte im Überblick
      </p>

      {error && (
        <div role="alert" style={{ color: '#991B1B', fontSize: '18px', marginBottom: '16px' }}>
          {error}
        </div>
      )}

      {/* Decade bars */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
        {decades.map((d) => {
          const colors = STATUS_COLORS[d.status];
          const isSelected = selectedDecade === d.decade;
          const maxCount = Math.max(...decades.map((x) => x.entityCount), 1);
          const barWidth = Math.max((d.entityCount / maxCount) * 100, 8);

          return (
            <button
              key={d.decade}
              onClick={() => handleDecadeClick(d.decade)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                backgroundColor: isSelected ? colors.bg : '#FEFCE8',
                border: `2px solid ${isSelected ? colors.border : '#FDE68A'}`,
                borderRadius: '12px',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                minHeight: '48px',
              }}
            >
              <span style={{ fontSize: '18px', fontWeight: 600, color: '#451A03', minWidth: '60px' }}>
                {d.decade}
              </span>
              <div style={{ flex: 1, height: '24px', backgroundColor: '#F3F4F6', borderRadius: '12px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${barWidth}%`,
                    height: '100%',
                    backgroundColor: colors.border,
                    borderRadius: '12px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <span style={{ fontSize: '16px', color: '#78350F', minWidth: '80px', textAlign: 'right' }}>
                {d.entityCount} {d.entityCount === 1 ? 'Eintrag' : 'Einträge'}
              </span>
              {d.status !== 'covered' && (
                <span
                  style={{
                    fontSize: '14px',
                    color: colors.border,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {colors.label}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Entity list for selected decade */}
      {selectedDecade && (
        <div style={{ width: '100%' }}>
          <h2
            style={{
              fontFamily: "Georgia, 'Times New Roman', Palatino, serif",
              fontSize: '24px',
              fontWeight: 600,
              color: '#451A03',
              marginBottom: '16px',
            }}
          >
            {selectedDecade}
          </h2>
          {entities.length === 0 ? (
            <p style={{ fontSize: '18px', color: '#78350F' }}>
              Noch keine Einträge für dieses Jahrzehnt.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {entities.map((ent) => {
                const typeColors = ENTITY_TYPE_COLORS[ent.type] || { bg: '#F3F4F6', text: '#374151' };
                return (
                  <div
                    key={ent.id}
                    style={{
                      backgroundColor: '#FEF3C7',
                      border: '1px solid #FDE68A',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '12px',
                    }}
                  >
                    <span
                      style={{
                        backgroundColor: typeColors.bg,
                        color: typeColors.text,
                        fontSize: '14px',
                        fontWeight: 600,
                        padding: '4px 12px',
                        borderRadius: '20px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {ENTITY_TYPE_EMOJI[ent.type]} {ent.type}
                    </span>
                    <div>
                      <p style={{ fontSize: '18px', fontWeight: 600, color: '#451A03' }}>{ent.name}</p>
                      <p style={{ fontSize: '16px', color: '#78350F', lineHeight: 1.5 }}>{ent.context}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
