import { useState } from 'react';
import {
  Bell,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';

export default function AppHeader({
  title = 'Kyntü',
  profileLabel = 'Comprador',
  showProfileSwitch = false,
  onChangeProfile,
  onUpdateData,
  onDashboard,
  onLogout,
  notifications,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const closeMenus = () => {
    setMenuOpen(false);
    setProfileOpen(false);
  };

  const handleAction = (action) => {
    closeMenus();
    action?.();
  };

  const profileInitial =
    profileLabel?.trim()?.charAt(0)?.toUpperCase() || 'U';

  return (
    <>
      <header className="app-header" style={styles.header}>
        <div className="app-header-main" style={styles.mainRow}>
          <div className="app-header-brand" style={styles.brand}>
            <img
              src="/icono_1.png"
              alt="Kyntü"
              style={styles.logo}
            />

            <div style={styles.brandText}>
              <span style={styles.brandName}>Kyntü</span>
              <span style={styles.pageTitle}>{title}</span>
            </div>
          </div>

          <nav
            className="app-header-desktop-nav"
            style={styles.desktopNav}
            aria-label="Menú principal"
          >
            <button
              type="button"
              onClick={() => handleAction(onDashboard)}
              className="app-header-nav-button"
              style={styles.navButton}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>

            <button
              type="button"
              onClick={() => handleAction(onUpdateData)}
              className="app-header-nav-button"
              style={styles.navButton}
            >
              <RefreshCw size={18} />
              Actualizar datos
            </button>

            {showProfileSwitch && (
              <button
                type="button"
                onClick={() => handleAction(onChangeProfile)}
                className="app-header-nav-button"
                style={styles.navButton}
              >
                <UsersRound size={18} />
                Cambiar perfil
              </button>
            )}
          </nav>

          <div style={styles.actions}>
            {notifications && (
              <div
                className="app-header-notifications"
                style={styles.notifications}
                aria-label="Notificaciones"
              >
                {notifications}
              </div>
            )}

            <div style={styles.profileWrapper}>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((current) => !current);
                  setMenuOpen(false);
                }}
                className="app-header-profile-button"
                style={styles.profileButton}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <span style={styles.avatar}>{profileInitial}</span>

                <span className="app-header-profile-copy" style={styles.profileCopy}>
                  <span style={styles.profileCaption}>Perfil activo</span>
                  <strong style={styles.profileName}>{profileLabel}</strong>
                </span>

                <ChevronDown
                  size={17}
                  style={{
                    ...styles.chevron,
                    transform: profileOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>

              {profileOpen && (
                <div
                  className="app-header-profile-menu"
                  style={styles.profileMenu}
                  role="menu"
                >
                  <div style={styles.profileMenuHeader}>
                    <span style={styles.profileMenuIcon}>
                      <UserRound size={19} />
                    </span>

                    <div>
                      <p style={styles.profileMenuLabel}>Sesión iniciada como</p>
                      <strong style={styles.profileMenuName}>{profileLabel}</strong>
                    </div>
                  </div>

                  {showProfileSwitch && (
                    <button
                      type="button"
                      onClick={() => handleAction(onChangeProfile)}
                      className="app-header-menu-item"
                      style={styles.menuItem}
                      role="menuitem"
                    >
                      <UsersRound size={17} />
                      Cambiar perfil
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleAction(onUpdateData)}
                    className="app-header-menu-item"
                    style={styles.menuItem}
                    role="menuitem"
                  >
                    <RefreshCw size={17} />
                    Actualizar datos
                  </button>

                  <div style={styles.menuDivider} />

                  <button
                    type="button"
                    onClick={() => handleAction(onLogout)}
                    className="app-header-menu-item app-header-logout-item"
                    style={styles.logoutItem}
                    role="menuitem"
                  >
                    <LogOut size={17} />
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setMenuOpen((current) => !current);
                setProfileOpen(false);
              }}
              className="app-header-mobile-toggle"
              style={styles.mobileToggle}
              aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav
            className="app-header-mobile-menu"
            style={styles.mobileMenu}
            aria-label="Menú móvil"
          >
            <button
              type="button"
              onClick={() => handleAction(onDashboard)}
              className="app-header-mobile-item"
              style={styles.mobileMenuItem}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>

            <button
              type="button"
              onClick={() => handleAction(onUpdateData)}
              className="app-header-mobile-item"
              style={styles.mobileMenuItem}
            >
              <RefreshCw size={18} />
              Actualizar datos
            </button>

            {showProfileSwitch && (
              <button
                type="button"
                onClick={() => handleAction(onChangeProfile)}
                className="app-header-mobile-item"
                style={styles.mobileMenuItem}
              >
                <UsersRound size={18} />
                Cambiar perfil
              </button>
            )}

            <button
              type="button"
              onClick={() => handleAction(onLogout)}
              className="app-header-mobile-item app-header-mobile-logout"
              style={styles.mobileLogout}
            >
              <LogOut size={18} />
              Cerrar sesión
            </button>
          </nav>
        )}
      </header>

      <style jsx>{`
        .app-header-nav-button,
        .app-header-profile-button,
        .app-header-mobile-toggle,
        .app-header-menu-item,
        .app-header-mobile-item {
          transition:
            background 0.2s ease,
            color 0.2s ease,
            border-color 0.2s ease,
            box-shadow 0.2s ease,
            transform 0.2s ease;
        }

        .app-header-nav-button:hover {
          color: #176bff !important;
          background: #f1f6ff !important;
          border-color: #cfe0ff !important;
          transform: translateY(-1px);
        }

        .app-header-profile-button:hover {
          border-color: #bcd1f5 !important;
          box-shadow: 0 8px 24px rgba(29, 67, 122, 0.1);
        }

        .app-header-menu-item:hover,
        .app-header-mobile-item:hover {
          background: #f4f8ff !important;
          color: #176bff !important;
        }

        .app-header-logout-item:hover,
        .app-header-mobile-logout:hover {
          background: #fff3f2 !important;
          color: #c1342d !important;
        }

        .app-header-nav-button:focus-visible,
        .app-header-profile-button:focus-visible,
        .app-header-mobile-toggle:focus-visible,
        .app-header-menu-item:focus-visible,
        .app-header-mobile-item:focus-visible {
          outline: 3px solid rgba(23, 107, 255, 0.2);
          outline-offset: 2px;
        }

        .app-header-mobile-toggle,
        .app-header-mobile-menu {
          display: none !important;
        }

        @media (max-width: 1080px) {
          .app-header-desktop-nav {
            display: none !important;
          }

          .app-header-mobile-toggle {
            display: inline-flex !important;
          }

          .app-header-mobile-menu {
            display: grid !important;
          }
        }

        @media (max-width: 700px) {
          .app-header {
            padding: 14px !important;
            border-radius: 20px !important;
          }

          .app-header-main {
            gap: 12px !important;
          }

          .app-header-brand {
            min-width: 0 !important;
          }

          .app-header-profile-copy,
          .app-header-profile-button > :global(svg) {
            display: none !important;
          }

          .app-header-profile-button {
            min-width: 46px !important;
            padding: 4px !important;
            border: 0 !important;
            background: transparent !important;
          }

          .app-header-notifications {
            min-width: 42px !important;
            min-height: 42px !important;
          }
        }

        @media (max-width: 480px) {
          .app-header-brand img {
            width: 42px !important;
            height: 42px !important;
          }

          .app-header-brand span:first-child {
            font-size: 18px !important;
          }

          .app-header-brand span:last-child {
            max-width: 145px !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
          }

          .app-header-profile-menu {
            right: -48px !important;
            width: min(280px, calc(100vw - 28px)) !important;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .app-header-nav-button,
          .app-header-profile-button,
          .app-header-mobile-toggle,
          .app-header-menu-item,
          .app-header-mobile-item {
            transition: none;
          }
        }
      `}</style>
    </>
  );
}

const styles = {
  header: {
  position: 'sticky',
  top: '0px',
  zIndex: 1000,
  width: '100%',
  padding: '14px 18px',
  boxSizing: 'border-box',
  borderRadius: '24px',
  background: 'rgba(255, 255, 255, 0.96)',
  border: '1px solid rgba(214, 225, 239, 0.95)',
  boxShadow: '0 18px 50px rgba(31, 69, 122, 0.11)',
  backdropFilter: 'blur(18px)',
},

  mainRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '18px',
  },

  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: '220px',
  },

  logo: {
    width: '48px',
    height: '48px',
    objectFit: 'contain',
    flexShrink: 0,
  },

  brandText: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },

  brandName: {
    color: '#061b41',
    fontSize: '21px',
    lineHeight: 1.1,
    fontWeight: 900,
    letterSpacing: '-0.025em',
  },

  pageTitle: {
    marginTop: '3px',
    color: '#6d7f98',
    fontSize: '12px',
    lineHeight: 1.2,
    fontWeight: 700,
  },

  desktopNav: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    flex: 1,
  },

  navButton: {
    minHeight: '42px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px 14px',
    borderRadius: '12px',
    border: '1px solid transparent',
    background: 'transparent',
    color: '#49617f',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 800,
    whiteSpace: 'nowrap',
  },

  actions: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '8px',
    minWidth: '220px',
  },

  notifications: {
    minWidth: '46px',
    minHeight: '46px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileWrapper: {
    position: 'relative',
  },

  profileButton: {
    minHeight: '48px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '5px 10px 5px 6px',
    borderRadius: '14px',
    border: '1px solid #dbe5f1',
    background: '#f8fbff',
    color: '#17365e',
    cursor: 'pointer',
  },

  avatar: {
    width: '36px',
    height: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #176bff 0%, #00b89c 100%)',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 900,
    boxShadow: '0 8px 18px rgba(23, 107, 255, 0.2)',
  },

  profileCopy: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    lineHeight: 1.05,
  },

  profileCaption: {
    color: '#8594aa',
    fontSize: '10px',
    fontWeight: 700,
  },

  profileName: {
    marginTop: '3px',
    color: '#17365e',
    fontSize: '13px',
    fontWeight: 900,
  },

  chevron: {
    color: '#7589a3',
    transition: 'transform 0.2s ease',
  },

  profileMenu: {
    position: 'absolute',
    top: 'calc(100% + 10px)',
    right: 0,
    zIndex: 50,
    width: '260px',
    padding: '10px',
    borderRadius: '16px',
    background: '#ffffff',
    border: '1px solid #dbe5f1',
    boxShadow: '0 22px 55px rgba(31, 69, 122, 0.18)',
  },

  profileMenuHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    marginBottom: '6px',
    borderRadius: '12px',
    background: '#f5f9ff',
  },

  profileMenuIcon: {
    width: '36px',
    height: '36px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '11px',
    background: '#e8f1ff',
    color: '#176bff',
  },

  profileMenuLabel: {
    margin: 0,
    color: '#8190a5',
    fontSize: '10px',
    fontWeight: 700,
  },

  profileMenuName: {
    display: 'block',
    marginTop: '3px',
    color: '#17365e',
    fontSize: '13px',
    fontWeight: 900,
  },

  menuItem: {
    width: '100%',
    minHeight: '42px',
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '10px 11px',
    border: 0,
    borderRadius: '11px',
    background: 'transparent',
    color: '#49617f',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 800,
    textAlign: 'left',
  },

  menuDivider: {
    height: '1px',
    margin: '7px 4px',
    background: '#e7edf5',
  },

  logoutItem: {
    width: '100%',
    minHeight: '42px',
    display: 'flex',
    alignItems: 'center',
    gap: '9px',
    padding: '10px 11px',
    border: 0,
    borderRadius: '11px',
    background: 'transparent',
    color: '#c1342d',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 800,
    textAlign: 'left',
  },

  mobileToggle: {
    width: '44px',
    height: '44px',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    borderRadius: '13px',
    border: '1px solid #dbe5f1',
    background: '#f8fbff',
    color: '#17365e',
    cursor: 'pointer',
  },

  mobileMenu: {
    display: 'none',
    gridTemplateColumns: '1fr',
    gap: '6px',
    marginTop: '12px',
    paddingTop: '12px',
    borderTop: '1px solid #e5ecf4',
  },

  mobileMenuItem: {
    width: '100%',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '11px 12px',
    border: 0,
    borderRadius: '12px',
    background: '#f8fbff',
    color: '#49617f',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 800,
    textAlign: 'left',
  },

  mobileLogout: {
    width: '100%',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '11px 12px',
    border: 0,
    borderRadius: '12px',
    background: '#fff7f6',
    color: '#c1342d',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 800,
    textAlign: 'left',
  },
};