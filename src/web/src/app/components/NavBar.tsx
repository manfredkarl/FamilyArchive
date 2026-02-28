'use client';

import Link from 'next/link';

export default function NavBar() {
  return (
    <nav
      className="flex items-center justify-between border-b-2 px-6"
      style={{
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A',
        height: '64px',
        fontSize: '18px',
      }}
    >
      <Link
        href="/"
        className="font-semibold"
        style={{ color: '#451A03', fontSize: '20px' }}
      >
        💛 Omas Geschichten
      </Link>
      <div className="flex items-center" style={{ gap: '24px' }}>
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
