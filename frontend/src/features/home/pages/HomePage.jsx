import { appConfig } from '../../../config/appConfig.js';
import styles from './HomePage.module.css';

export function HomePage() {
  return (
    <section className={styles.hero} aria-labelledby="home-heading">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>Circular fashion, considered.</p>
        <h1 id="home-heading" className={styles.heading}>
          Wear more.
          <br />
          Own less.
        </h1>
        <p className={styles.lede}>
          A new home for renting, reselling, and discovering fashion that moves with you —
          not the other way around.
        </p>

        <div className={styles.status} role="status">
          <span className={styles.dot} aria-hidden="true" />
          Frontend foundation online
        </div>
        <p className={styles.note}>Marketplace experiences arrive in the next phases.</p>
      </div>

      <aside className={styles.panel} aria-label="Foundation status">
        <p className={styles.panelKicker}>Build 01</p>
        <h2 className={styles.panelTitle}>Foundations first.</h2>
        <ul className={styles.list}>
          <li>React + Vite client</li>
          <li>Express REST API</li>
          <li>PostgreSQL in Docker</li>
        </ul>
        <p className={styles.panelFoot}>
          Health endpoint
          <code>{appConfig.apiBaseUrl}/health</code>
        </p>
      </aside>
    </section>
  );
}
