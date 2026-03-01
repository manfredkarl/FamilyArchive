'use client';

import Link from 'next/link';

export default function NavBar() {
  return (
    <nav
      className="flex items-center justify-between border-b-2 px-6"
      style={{
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
        minHeight: '64px',
        height: 'auto',
        fontSize: '18px',
        flexWrap: 'wrap',
        padding: '8px 24px',
      }}
    >
      <Link
        href="/"
        className="font-semibold"
        style={{ color: '#451A03', fontSize: '20px' }}
      >
        💛 Omas Geschichten
      </Link>
      <div className="flex items-center" style={{ gap: 'clamp(12px, 3vw, 24px)', flexWrap: 'wrap' }}>
        <Link
          href="/history"
          className="hover:underline"
          style={{ color: '#78350F', minWidth: '48px', minHeight: '48px', display: 'inline-flex', alignItems: 'center' }}
        >
          📖 Gespräche
        </Link>
        <Link
          href="/ask"
          className="hover:underline"
          style={{ color: '#78350F', minWidth: '48px', minHeight: '48px', display: 'inline-flex', alignItems: 'center' }}
        >
          🔍 Fragen
        </Link>
        <Link
          href="/timeline"
          className="hover:underline"
          style={{ color: '#78350F', minWidth: '48px', minHeight: '48px', display: 'inline-flex', alignItems: 'center' }}
        >
          📅 Zeitstrahl
        </Link>
      </div>
    </nav>
  );
}
