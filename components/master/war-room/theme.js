export const colors = {
  sidebar: '#0B1F4A',
  sidebarActive: '#1E3A8A',
  pageBg: '#F4F7FB',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  muted: '#64748B',
  accent: '#0A4DFF',
};

export const layout = {
  shell: {
    display: 'flex',
    minHeight: '100vh',
    fontFamily: 'Arial, Helvetica, sans-serif',
    backgroundColor: colors.pageBg,
    color: colors.text,
  },
  main: {
    flex: 1,
    padding: '28px 32px',
    overflowY: 'auto',
  },
  card: {
    backgroundColor: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    padding: 20,
    boxShadow: '0 4px 20px rgba(15, 23, 42, 0.06)',
  },
  cardTitle: {
    margin: '0 0 12px',
    fontSize: 16,
    fontWeight: 800,
    color: colors.text,
  },
  sectionTitle: {
    margin: '0 0 16px',
    fontSize: 22,
    fontWeight: 800,
  },
  grid2: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 16,
  },
  grid3: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 16,
  },
};

export const legendItems = [
  { id: 'ok', label: 'En línea / validado', color: '#059669' },
  { id: 'warn', label: 'En observación', color: '#D97706' },
  { id: 'risk', label: 'En riesgo', color: '#DC2626' },
  { id: 'info', label: 'Sin datos / informativo', color: '#0A4DFF' },
];
