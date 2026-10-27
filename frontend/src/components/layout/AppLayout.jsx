import { NavLink, Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { appConfig } from '../../config/appConfig.js';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const { isAuthed, user } = useAuth();
  const year = new Date().getFullYear();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/" className={styles.brand} aria-label={`${appConfig.name} home`}>
            <span className={styles.brandIcon} aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="14" cy="14" r="12" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="M14 6v16M6 14h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <span className={styles.brandName}>{appConfig.name}</span>
          </Link>

          <nav className={styles.nav} aria-label="Main navigation">
            <NavLink
              to="/listings"
              className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}
            >
              Browse
            </NavLink>
            {isAuthed && (
              <>
                <NavLink
                  to="/bookings"
                  className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}
                >
                  Rentals
                </NavLink>
                <NavLink
                  to="/orders"
                  className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}
                >
                  Orders
                </NavLink>
                <NavLink
                  to="/profile"
                  className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}
                >
                  Profile
                </NavLink>
              </>
            )}
          </nav>

          <div className={styles.headerActions}>
            {isAuthed ? (
              <div className={styles.userMenu}>
                <span className={styles.userAvatar}>
                  {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                </span>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user?.displayName || user?.email}</span>
                  <span className={styles.userEmail}>{user?.email}</span>
                </div>
                <Link to="/profile" className="btn btn-ghost">
                  Sign out
                </Link>
              </div>
            ) : (
              <div className={styles.authActions}>
                <Link to="/login" className="btn btn-ghost">Sign in</Link>
                <Link to="/register" className="btn btn-primary">Get started</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <Link to="/" className={styles.footerLogo}>{appConfig.name}</Link>
            <p className={styles.footerTagline}>Circular fashion, considered.</p>
          </div>
          <nav className={styles.footerNav}>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Marketplace</span>
              <Link to="/listings">Browse listings</Link>
              <Link to="/listings/new">Create listing</Link>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Account</span>
              <Link to="/profile">Profile</Link>
              <Link to="/orders">Orders</Link>
              <Link to="/bookings">My rentals</Link>
            </div>
            <div className={styles.footerCol}>
              <span className={styles.footerColTitle}>Support</span>
              <Link to="/disputes">Disputes</Link>
              {isAuthed && user?.roles?.includes('admin') && (
                <Link to="/admin">Admin</Link>
              )}
            </div>
          </nav>
          <p className={styles.footerCopy}>
            © {year} {appConfig.name}. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
