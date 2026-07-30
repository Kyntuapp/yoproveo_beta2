import AppHeader from './AppHeader';

export default function AppLayout({
  children,
  title,
  profileLabel = 'Comprador',
  showProfileSwitch = false,
  onChangeProfile,
  onUpdateData,
  onDashboard,
  onLogout,
  notifications,
}) {
  return (
    <>
      <div className="app-layout-page" style={styles.page}>
        <div style={styles.backgroundGlow} />

        <img
          src="/yoproveo_logo_mvp.png"
          alt=""
          aria-hidden="true"
          style={styles.watermark}
        />

        <div style={styles.wrapper}>
          <AppHeader
            title={title}
            profileLabel={profileLabel}
            showProfileSwitch={showProfileSwitch}
            onChangeProfile={onChangeProfile}
            onUpdateData={onUpdateData}
            onDashboard={onDashboard}
            onLogout={onLogout}
            notifications={notifications}
          />

          <main className="app-layout-content" style={styles.content}>
            {children}
          </main>
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 820px) {
          .app-layout-page {
            padding: 16px !important;
          }

          .app-layout-content {
            gap: 18px !important;
            margin-top: 18px !important;
          }
        }

        @media (max-width: 620px) {
          .app-layout-page {
            padding: 10px !important;
          }

          .app-layout-content {
            gap: 14px !important;
            margin-top: 14px !important;
          }
        }
      `}</style>
    </>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    minHeight: '100dvh',
    position: 'relative',
    overflowX: 'hidden',
    padding: '24px',
    boxSizing: 'border-box',
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background:
      'radial-gradient(circle at 10% 8%, rgba(23,107,255,0.12), transparent 30%), radial-gradient(circle at 90% 82%, rgba(0,194,168,0.10), transparent 28%), linear-gradient(145deg, #f8fbff 0%, #eef5ff 48%, #f8fcfb 100%)',
  },

  backgroundGlow: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    background:
      'radial-gradient(circle at 18% 18%, rgba(23,107,255,0.08), transparent 34%), radial-gradient(circle at 82% 76%, rgba(0,194,168,0.07), transparent 30%)',
    zIndex: 0,
  },

  watermark: {
    position: 'fixed',
    top: '24px',
    left: '32px',
    width: '250px',
    maxWidth: '45vw',
    opacity: 0.035,
    zIndex: 0,
    pointerEvents: 'none',
    userSelect: 'none',
  },

  wrapper: {
    position: 'relative',
    zIndex: 2,
    width: '100%',
    maxWidth: '1440px',
    margin: '0 auto',
  },

  content: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
    marginTop: '24px',
  },
};
