import { useState, useEffect, useRef, useId } from 'react';
import { NavLink, Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { useBag } from '../../context/BagContext.jsx';
import { useFavorites } from '../../context/FavoritesContext.jsx';
import { appConfig } from '../../config/appConfig.js';
import { BagDrawer } from '../rental/BagDrawer.jsx';
import { ToastContainer } from '../feedback/index.js';
import styles from './AppLayout.module.css';

const ANNOUNCEMENTS = [
  '✦ Complimentary 2nd backup size on all event dress rentals',
  '✦ Eco-friendly dry cleaning included — zero laundry required',
  '✦ Free prepaid return satchel with doorstep courier pickup',
];

const POPULAR_SEARCHES = [
  'Sabyasachi',
  'Tarun Tahiliani',
  'Manish Malhotra',
  'Bridal Lehenga',
  'Evening Gown',
  'Raw Mango',
  'Cocktail Sari',
];

export function AppLayout() {
  const { isAuthed, user, logout, isAdmin } = useAuth();
  const { draft, openBag } = useBag();
  const { favoriteIds } = useFavorites();
  const navigate = useNavigate();
  const location = useLocation();
  const menuDrawerId = useId();
  const searchModalId = useId();

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState(0);
  const [isAnnouncementPaused, setIsAnnouncementPaused] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  const searchInputRef = useRef(null);
  const menuButtonRef = useRef(null);
  const year = new Date().getFullYear();

  // Online / offline network detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Rotating announcement bar (5s cycle on mobile, tap to pause)
  useEffect(() => {
    if (isAnnouncementPaused) return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const timer = setInterval(() => {
      setActiveAnnouncement((prev) => (prev + 1) % ANNOUNCEMENTS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isAnnouncementPaused]);

  // Close overlays on route change
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [location.pathname, location.search]);

  // Lock body scroll when mobile drawers or modals are open
  useEffect(() => {
    if (menuOpen || searchOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [menuOpen, searchOpen]);

  // Focus search input when search modal opens
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
    }
  }, [searchOpen]);

  // Close overlays on Escape key
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (menuOpen) {
          setMenuOpen(false);
          menuButtonRef.current?.focus();
        }
        if (searchOpen) {
          setSearchOpen(false);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen, searchOpen]);

  // Detect virtual keyboard to hide bottom tab bar while typing
  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;
    const vv = window.visualViewport;
    const handleViewportResize = () => {
      const heightDiff = window.innerHeight - vv.height;
      setKeyboardVisible(heightDiff > 140);
    };
    vv.addEventListener('resize', handleViewportResize);
    return () => vv.removeEventListener('resize', handleViewportResize);
  }, []);

  async function handleLogout() {
    await logout();
    setMenuOpen(false);
    navigate('/');
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;
    navigate(`/listings?q=${encodeURIComponent(query)}`);
    setSearchOpen(false);
    setSearchQuery('');
  }

  function handleChipSearch(term) {
    navigate(`/listings?q=${encodeURIComponent(term)}`);
    setSearchOpen(false);
    setSearchQuery('');
  }

  const isPdpRoute = /^\/listings\/[^/]+$/.test(location.pathname);
  const isBrowseActive = location.pathname.startsWith('/listings');
  const isFavoritesActive = location.pathname === '/favorites';
  const isAccountActive = ['/profile', '/login', '/register', '/bookings', '/orders'].includes(location.pathname);

  return (
    <div className={styles.shell}>
      {/* ── Offline Reassurance Banner ── */}
      {!isOnline && (
        <div className={styles.offlineBanner} role="status">
          <span>✦</span>
          <span>Offline — reservations resume when you reconnect.</span>
          <span>✦</span>
        </div>
      )}

      {/* ── Top Announcement Bar ── */}
      <aside
        className={styles.topBar}
        onClick={() => setIsAnnouncementPaused((prev) => !prev)}
        role="region"
        aria-label="Announcements"
      >
        {/* Mobile Single Rotating Item */}
        <div className={styles.mobileAnnouncement}>
          <span className={styles.announcementText}>
            {ANNOUNCEMENTS[activeAnnouncement]}
          </span>
          <span className={styles.announcementChevron}>›</span>
        </div>

        {/* Desktop Triple Item Ribbon */}
        <div className={styles.topBarInner}>
          <span>Complimentary 2nd backup size on all event dress rentals</span>
          <span className={styles.topBarDivider}>✦</span>
          <span>Eco-friendly dry cleaning included</span>
          <span className={styles.topBarDivider}>✦</span>
          <span>Free pre-paid return garment bag</span>
        </div>
      </aside>

      {/* ── Main Navigation Header ── */}
      <header className={styles.header}>
        <div className={styles.headerInner}>
          {/* Mobile hamburger button */}
          <button
            ref={menuButtonRef}
            type="button"
            className={styles.mobileMenuBtn}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-controls={menuDrawerId}
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
              {menuOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <>
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>

          {/* Brand Logo */}
          <Link to="/" className={styles.brand} aria-label={`${appConfig.name} Home`}>
            <img
              src="/logo-dark.png"
              alt="Exchange24 - Rent Wear Repeat"
              className={styles.brandLogoImg}
            />
          </Link>

          {/* Primary Navigation Links (Desktop) */}
          <nav className={styles.desktopNav} aria-label="Main navigation">
            <NavLink
              to="/listings?rental=true"
              className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}
            >
              Rent for Events
            </NavLink>
            <NavLink
              to="/listings?occasion=WeddingGuest"
              className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}
            >
              Weddings
            </NavLink>
            <NavLink
              to="/listings?occasion=Cocktail"
              className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}
            >
              Cocktail &amp; Gala
            </NavLink>
            <NavLink
              to="/listings?sale=true"
              className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}
            >
              Buy Pre-Loved
            </NavLink>
            <NavLink
              to="/lend"
              className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}
            >
              Lend Couture
            </NavLink>
            <NavLink
              to="/blog"
              className={({ isActive }) => isActive ? styles.navLinkActive : styles.navLink}
            >
              The Journal
            </NavLink>
          </nav>

          {/* Header Action Utilities */}
          <div className={styles.headerActions}>
            {/* Search Trigger */}
            <button
              type="button"
              className={styles.searchLink}
              onClick={() => setSearchOpen(true)}
              aria-label="Search catalog"
              title="Search catalog"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className={styles.searchLabel}>Search</span>
            </button>

            {/* Saved Hearts (Desktop only in header; mobile uses bottom tab) */}
            <Link to="/favorites" className={styles.desktopHeartLink} title="Saved Looks">
              <svg width="18" height="18" viewBox="0 0 24 24" fill={favoriteIds.size > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {favoriteIds.size > 0 && <span className={styles.badgeCount}>{favoriteIds.size}</span>}
              <span className={styles.searchLabel}>Hearts</span>
            </Link>

            {/* Slide-out Bag Trigger */}
            <button
              type="button"
              className={styles.bagTriggerBtn}
              onClick={openBag}
              aria-label="View rental bag"
              title="View rental bag"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {draft && <span className={styles.bagIndicatorDot} />}
              <span className={styles.searchLabel}>Bag</span>
            </button>

            {/* User Account Controls (Desktop header) */}
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

      {/* ── Slide-Out Left Navigation Sheet (Mobile) ── */}
      {menuOpen && (
        <div
          className={styles.menuOverlay}
          onClick={() => setMenuOpen(false)}
          role="presentation"
        >
          <aside
            id={menuDrawerId}
            className={styles.menuDrawer}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation Menu"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.menuDrawerHeader}>
              <Link
                to="/"
                className={styles.menuDrawerBrand}
                onClick={() => setMenuOpen(false)}
                aria-label={`${appConfig.name} Home`}
              >
                <img
                  src="/logo-dark.png"
                  alt="Exchange24 - Rent Wear Repeat"
                  className={styles.drawerBrandLogoImg}
                />
              </Link>
              <button
                type="button"
                className={styles.menuCloseBtn}
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            <div className={styles.menuDrawerBody}>
              <div className={styles.menuSectionTitle}>Curated Collections</div>
              <NavLink
                to="/listings?rental=true"
                className={({ isActive }) => isActive ? styles.menuDrawerLinkActive : styles.menuDrawerLink}
                onClick={() => setMenuOpen(false)}
              >
                Rent for Events
              </NavLink>
              <NavLink
                to="/listings?occasion=WeddingGuest"
                className={({ isActive }) => isActive ? styles.menuDrawerLinkActive : styles.menuDrawerLink}
                onClick={() => setMenuOpen(false)}
              >
                Weddings
              </NavLink>
              <NavLink
                to="/listings?occasion=Cocktail"
                className={({ isActive }) => isActive ? styles.menuDrawerLinkActive : styles.menuDrawerLink}
                onClick={() => setMenuOpen(false)}
              >
                Cocktail &amp; Gala
              </NavLink>
              <NavLink
                to="/listings?sale=true"
                className={({ isActive }) => isActive ? styles.menuDrawerLinkActive : styles.menuDrawerLink}
                onClick={() => setMenuOpen(false)}
              >
                Buy Pre-Loved
              </NavLink>
              <NavLink
                to="/lend"
                className={({ isActive }) => isActive ? styles.menuDrawerLinkActive : styles.menuDrawerLink}
                onClick={() => setMenuOpen(false)}
              >
                Lend Couture
              </NavLink>
              <NavLink
                to="/blog"
                className={({ isActive }) => isActive ? styles.menuDrawerLinkActive : styles.menuDrawerLink}
                onClick={() => setMenuOpen(false)}
              >
                The Journal &amp; Style Guides
              </NavLink>

              <div className={styles.menuDivider} />

              <div className={styles.menuSectionTitle}>My Closet &amp; Orders</div>
              <NavLink
                to="/bookings"
                className={({ isActive }) => isActive ? styles.menuDrawerLinkActive : styles.menuDrawerLink}
                onClick={() => setMenuOpen(false)}
              >
                My Rentals &amp; Returns
              </NavLink>
              <NavLink
                to="/orders"
                className={({ isActive }) => isActive ? styles.menuDrawerLinkActive : styles.menuDrawerLink}
                onClick={() => setMenuOpen(false)}
              >
                Order History
              </NavLink>
              <NavLink
                to="/favorites"
                className={({ isActive }) => isActive ? styles.menuDrawerLinkActive : styles.menuDrawerLink}
                onClick={() => setMenuOpen(false)}
              >
                Saved Looks ({favoriteIds.size})
              </NavLink>
              <NavLink
                to="/profile"
                className={({ isActive }) => isActive ? styles.menuDrawerLinkActive : styles.menuDrawerLink}
                onClick={() => setMenuOpen(false)}
              >
                Fit &amp; Measurements
              </NavLink>
              <NavLink
                to="/disputes"
                className={({ isActive }) => isActive ? styles.menuDrawerLinkActive : styles.menuDrawerLink}
                onClick={() => setMenuOpen(false)}
              >
                Disputes &amp; Support
              </NavLink>
              {isAdmin && (
                <NavLink
                  to="/admin"
                  className={({ isActive }) => isActive ? styles.menuDrawerLinkActive : styles.menuDrawerLink}
                  onClick={() => setMenuOpen(false)}
                >
                  Admin Operations
                </NavLink>
              )}

              <div className={styles.menuDivider} />

              <div className={styles.menuAuthFooter}>
                {isAuthed ? (
                  <div className={styles.menuUserBlock}>
                    <div className={styles.menuUserInfo}>
                      <span className={styles.menuUserAvatar}>
                        {user?.displayName?.charAt(0) || user?.email?.charAt(0) || 'U'}
                      </span>
                      <span className={styles.menuUserEmail}>
                        {user?.displayName || user?.email}
                      </span>
                    </div>
                    <button type="button" onClick={handleLogout} className={styles.menuSignOutBtn}>
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className={styles.menuGuestBlock}>
                    <Link to="/login" className={styles.menuLoginBtn} onClick={() => setMenuOpen(false)}>
                      Sign In
                    </Link>
                    <Link to="/register" className={styles.menuJoinBtn} onClick={() => setMenuOpen(false)}>
                      Join Exchange
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ── Full-Screen Mobile Search Overlay ── */}
      {searchOpen && (
        <div
          className={styles.searchOverlay}
          role="dialog"
          aria-modal="true"
          aria-label="Search catalog"
        >
          <div className={styles.searchModalHeader}>
            <form onSubmit={handleSearchSubmit} className={styles.searchForm}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.searchFormIcon}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={searchInputRef}
                id={searchModalId}
                type="search"
                className={styles.searchModalInput}
                placeholder="Search designer, lehenga, gown..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                enterKeyHint="search"
                autoComplete="off"
              />
            </form>
            <button
              type="button"
              className={styles.searchModalCloseBtn}
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
            >
              Cancel
            </button>
          </div>

          <div className={styles.searchModalBody}>
            <div className={styles.searchSuggestionsHeading}>Popular Designers &amp; Edits</div>
            <div className={styles.searchChips}>
              {POPULAR_SEARCHES.map((term) => (
                <button
                  key={term}
                  type="button"
                  className={styles.searchChip}
                  onClick={() => handleChipSearch(term)}
                >
                  {term}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

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
            <Link to="/" className={styles.footerBrandTitle} aria-label={`${appConfig.name} Home`}>
              <img
                src="/logo-dark.png"
                alt="Exchange24 - Rent Wear Repeat"
                className={styles.footerBrandLogoImg}
              />
            </Link>
            <p className={styles.footerDesc}>
              The luxury circular fashion and designer rental platform. Wear extraordinary pieces for milestone moments without the closet footprint.
            </p>
          </div>

          {/* Accordion 1: Explore */}
          <details className={styles.footerAccordion}>
            <summary className={styles.footerSummary}>
              <span>Explore</span>
              <span className={styles.summaryChevron}>▾</span>
            </summary>
            <div className={styles.footerLinksContent}>
              <span className={styles.desktopHeading}>Explore</span>
              <Link to="/listings">All Designer Listings</Link>
              <Link to="/listings?rental=true">Event Rentals</Link>
              <Link to="/listings?sale=true">Pre-Loved Resale</Link>
              <Link to="/lend">Lender Studio &amp; Earnings</Link>
              <Link to="/listings/new">List an Outfit</Link>
              <Link to="/blog">The Journal &amp; Editorial</Link>
            </div>
          </details>

          {/* Accordion 2: Account */}
          <details className={styles.footerAccordion}>
            <summary className={styles.footerSummary}>
              <span>Account</span>
              <span className={styles.summaryChevron}>▾</span>
            </summary>
            <div className={styles.footerLinksContent}>
              <span className={styles.desktopHeading}>Account</span>
              <Link to="/bookings">Active Rentals &amp; Returns</Link>
              <Link to="/orders">Order History</Link>
              <Link to="/profile">Fit &amp; Measurements</Link>
              {isAdmin && <Link to="/admin">Admin Operations</Link>}
            </div>
          </details>

          {/* Accordion 3: Trust & Sustainability */}
          <details className={styles.footerAccordion}>
            <summary className={styles.footerSummary}>
              <span>Trust &amp; Sustainability</span>
              <span className={styles.summaryChevron}>▾</span>
            </summary>
            <div className={styles.footerLinksContent}>
              <span className={styles.desktopHeading}>Trust &amp; Sustainability</span>
              <span>Ozone Dry Cleaning</span>
              <span>Damage Care Protection</span>
              <span>Zero Single-Use Packaging</span>
            </div>
          </details>
        </div>

        <div className={styles.footerBottom}>
          <p>© {year} {appConfig.name}. All rights reserved.</p>
        </div>
      </footer>

      {/* ── Mobile Primary Bottom Tab Bar (<768px, hidden on PDP and when keyboard open) ── */}
      {!isPdpRoute && !keyboardVisible && (
        <nav className={styles.bottomNav} aria-label="Primary Mobile Navigation">
          <NavLink
            to="/"
            end
            className={({ isActive }) => isActive ? styles.bottomNavItemActive : styles.bottomNavItem}
            aria-current={location.pathname === '/' ? 'page' : undefined}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className={styles.bottomNavLabel}>Home</span>
          </NavLink>

          <NavLink
            to="/listings"
            className={isBrowseActive ? styles.bottomNavItemActive : styles.bottomNavItem}
            aria-current={isBrowseActive ? 'page' : undefined}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            <span className={styles.bottomNavLabel}>Browse</span>
          </NavLink>

          <NavLink
            to="/favorites"
            className={isFavoritesActive ? styles.bottomNavItemActive : styles.bottomNavItem}
            aria-current={isFavoritesActive ? 'page' : undefined}
          >
            <div className={styles.bottomNavIconWrapper}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill={favoriteIds.size > 0 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {favoriteIds.size > 0 && <span className={styles.bottomNavBadge}>{favoriteIds.size}</span>}
            </div>
            <span className={styles.bottomNavLabel}>Saved</span>
          </NavLink>

          <button
            type="button"
            className={styles.bottomNavItem}
            onClick={openBag}
            aria-label="Rental Bag"
          >
            <div className={styles.bottomNavIconWrapper}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              {draft && <span className={styles.bottomNavIndicatorDot} />}
            </div>
            <span className={styles.bottomNavLabel}>Bag</span>
          </button>

          <NavLink
            to={isAuthed ? '/profile' : '/login'}
            className={isAccountActive ? styles.bottomNavItemActive : styles.bottomNavItem}
            aria-current={isAccountActive ? 'page' : undefined}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            <span className={styles.bottomNavLabel}>{isAuthed ? 'Account' : 'Sign In'}</span>
          </NavLink>
        </nav>
      )}

      {/* ── Global Slide-Out Rental Bag ── */}
      <BagDrawer />

      {/* ── Global Luxury Toast Notifications ── */}
      <ToastContainer />
    </div>
  );
}
