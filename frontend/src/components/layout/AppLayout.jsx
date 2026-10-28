import { useState } from 'react';
import { NavLink, Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { appConfig } from '../../config/appConfig.js';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const { isAuthed, user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const year = new Date().getFullYear();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <div className={styles.shell}>
      {/* ── Top Announcement Bar ── */}
      <div className={styles.topBar}>
        <div className={styles.topBarInner}>
          <span>Complimentary 2nd backup size on all event dress rentals</span>
          <span className={styles.topBarDivider}>•</span>
          <span>Eco-friendly dry cleaning included</span>
          <span className={styles.topBarDivider}>•</span>
          <span>Free pre-paid return garment bag</span>
        </div>
      </div>

      {/* ── Main Navigation Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {/* Mobile hamburger */}
          <button
            type="button"
            className={styles.mobileMenuBtn}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          {/* Brand Logo */}
          <Link to="/" className={styles.brand} aria-label={`${appConfig.name} Home`}>
            <span className={styles.brandName}>{appConfig.name}</span>
            <span className={styles.brandSubtitle}>THE CLOSET IN THE CLOUD</span>
          </Link>

          {/* Primary Navigation Links */}
          <nav className={`${styles.nav} ${menuOpen ? styles.navOpen : ''}`} aria-label="Main navigation">
            <NavLink
              to="/listings?rental=true"
              className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}
              onClick={() => setMenuOpen(false)}
            >
              Rent for Events
            </NavLink>
            <NavLink
              to="/listings?occasion=wedding"
              className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}
              onClick={() => setMenuOpen(false)}
            >
              Weddings
            </NavLink>
            <NavLink
              to="/listings?occasion=cocktail"
              className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}
              onClick={() => setMenuOpen(false)}
            >
              Cocktail & Gala
            </NavLink>
            <NavLink
              to="/listings?sale=true"
              className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}
              onClick={() => setMenuOpen(false)}
            >
              Buy Pre-Loved
            </NavLink>
          </nav>

          {/* Action Utilities (Search, Closet, Profile) */}
          <div className={styles.headerActions}>
            <Link to="/listings" className={styles.searchLink} title="Search catalog">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className={styles.searchLabel}>Search</span>
            </Link>

            {isAuthed ? (
              <div className={styles.userSection}>
                <Link to="/bookings" className={styles.closetLink} title="My Rentals">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <path d="M16 10a4 4 0 0 1-8 0" />
                  </svg>
                  <span className={styles.actionLabel}>My Rentals</span>
                </Link>

                <div className={styles.accountDropdown}>
                  <Link to="/profile" className={styles.avatarBtn} title="My Profile">
                    {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                  </Link>
                  <button type="button" onClick={handleLogout} className={styles.signOutBtn}>
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <div className={styles.authGroup}>
                <Link to="/login" className={styles.loginBtn}>Sign In</Link>
                <Link to="/register" className={styles.getStartedBtn}>Join</Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Main Viewport Content ── */}
      <main className={styles.main}>
        <Outlet />
      </main>

      {/* ── Editorial Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerGuarantees}>
          <div className={styles.guaranteeItem}>
            <span className={styles.guaranteeIcon}>✦</span>
            <strong>Guaranteed Fit</strong>
            <span>Complimentary backup size in every order</span>
          </div>
          <div className={styles.guaranteeItem}>
            <span className={styles.guaranteeIcon}>✦</span>
            <strong>Cleaning Handled</strong>
            <span>Zero dry cleaning or laundry required</span>
          </div>
          <div className={styles.guaranteeItem}>
            <span className={styles.guaranteeIcon}>✦</span>
            <strong>Seamless Returns</strong>
            <span>Drop off prepaid bag at any courier hub</span>
          </div>
        </div>

        <div className={styles.footerGrid}>
          <div className={styles.footerBrandCol}>
            <Link to="/" className={styles.footerBrandTitle}>{appConfig.name}</Link>
            <p className={styles.footerDesc}>
              The luxury circular fashion and designer rental platform. Wear extraordinary pieces for milestone moments without the closet footprint.
            </p>
          </div>

          <div className={styles.footerLinksCol}>
            <span className={styles.footerHeading}>Explore</span>
            <Link to="/listings">All Designer Listings</Link>
            <Link to="/listings?rental=true">Event Rentals</Link>
            <Link to="/listings?sale=true">Pre-Loved Resale</Link>
            <Link to="/listings/new">List an Outfit</Link>
          </div>

          <div className={styles.footerLinksCol}>
            <span className={styles.footerHeading}>Account</span>
            <Link to="/bookings">Active Rentals & Returns</Link>
            <Link to="/orders">Order History</Link>
            <Link to="/profile">Fit & Measurements</Link>
            {isAdmin && <Link to="/admin">Admin Operations</Link>}
          </div>

          <div className={styles.footerLinksCol}>
            <span className={styles.footerHeading}>Trust & Sustainability</span>
            <span>Ozone Dry Cleaning</span>
            <span>Damage Care Protection</span>
            <span>Zero Single-Use Packaging</span>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p>© {year} {appConfig.name}. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
