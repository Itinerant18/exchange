import { Link, Outlet } from 'react-router-dom';
import { appConfig } from '../../config/appConfig.js';
import styles from './AppLayout.module.css';

export function AppLayout() {
  const year = new Date().getFullYear();

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link to="/" className={styles.brand} aria-label={`${appConfig.name} home`}>
          <span className={styles.brandMark} aria-hidden="true">
            {appConfig.name.charAt(0)}
          </span>
          <span className={styles.brandName}>{appConfig.name}</span>
        </Link>
        <span className={styles.badge}>Foundation build</span>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <p>Circular fashion, considered.</p>
        <p>
          © {year} {appConfig.name}
        </p>
      </footer>
    </div>
  );
}
