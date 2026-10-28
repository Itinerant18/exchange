import styles from './BrandTicker.module.css';

const DESIGNERS = [
  'SABYASACHI',
  'MANISH MALHOTRA',
  'ANITA DONGRE',
  'ZIMMERMANN',
  'REFORMATION',
  'STAUD',
  'CULT GAIA',
  'HOUSE OF CB',
  'SELF-PORTRAIT',
  'TARUN TAHILIANI',
  'RAW MANGO',
  'GAURAV GUPTA',
];

export function BrandTicker() {
  return (
    <div className={styles.tickerWrapper} aria-label="Featured Designers">
      <div className={styles.tickerTrack}>
        {[...DESIGNERS, ...DESIGNERS].map((brand, idx) => (
          <div key={`${brand}-${idx}`} className={styles.tickerItem}>
            <span className={styles.brandName}>{brand}</span>
            <span className={styles.sparkle}>✦</span>
          </div>
        ))}
      </div>
    </div>
  );
}
