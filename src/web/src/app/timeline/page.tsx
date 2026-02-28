export default function TimelinePage() {
  return (
    <main
      className="flex flex-col items-center justify-center"
      style={{
        backgroundColor: '#FFFBEB',
        minHeight: 'calc(100vh - 64px)',
        color: '#451A03',
      }}
    >
      <h1
        style={{
          fontFamily: "Georgia, 'Times New Roman', Palatino, serif",
          fontSize: '30px',
          fontWeight: 700,
          marginBottom: '16px',
        }}
      >
        📅 Zeitstrahl
      </h1>
      <p style={{ fontSize: '20px', color: '#78350F' }}>Kommt bald</p>
    </main>
  );
}
