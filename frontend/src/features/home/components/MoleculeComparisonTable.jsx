import { Link } from 'react-router-dom';
import styles from './MoleculeComparisonTable.module.css';

const COMPARISON_ROWS = [
  {
    feature: 'Price per Designer Look',
    buying: '₹35,000 – ₹1,50,000+ retail cost',
    renting: 'Starting at ₹1,499 for 4 or 8 days',
    highlight: true,
  },
  {
    feature: 'Free Backup Size',
    buying: 'No — locked into a single fixed size',
    renting: 'Yes — complimentary 2nd size in every box',
    highlight: false,
  },
  {
    feature: 'Social Media & Outfit Repeating',
    buying: 'Wear 1–2 times before it sits in your closet',
    renting: 'Endless rotation — a fresh look for every event',
    highlight: false,
  },
  {
    feature: 'Dry Cleaning & Care',
    buying: '₹800 – ₹1,500 per wear at specialty dry cleaners',
    renting: '100% complimentary eco-cleaning & sanitization',
    highlight: false,
  },
  {
    feature: 'Accidental Damage Protection',
    buying: 'Full cost of repair or replacement out of pocket',
    renting: 'Optional ₹299 Festive Care protection covers minor wear',
    highlight: false,
  },
  {
    feature: 'Wardrobe Clutter & Sustainability',
    buying: 'Unworn pieces gathering dust in your wardrobe',
    renting: 'Zero clutter — return in prepaid satchel',
    highlight: false,
  },
];

export function MoleculeComparisonTable() {
  return (
    <section className={styles.section} aria-label="Why Rent Instead of Buy">
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>THE CLOSET REVOLUTION</span>
          <h2 className={styles.heading}>Why buy when you could rent?</h2>
          <p className={styles.subheading}>
            Save thousands in rupees, precious closet space, and the planet with circular luxury fashion.
          </p>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.featureColHeader}>The Experience</th>
                <th className={styles.buyingColHeader}>
                  <div className={styles.headerCard}>
                    <span className={styles.colTitle}>Buying New</span>
                    <span className={styles.colSubtext}>Traditional retail ownership</span>
                  </div>
                </th>
                <th className={styles.rentingColHeader}>
                  <div className={styles.headerCardRenting}>
                    <span className={styles.badgePopular}>Smart Fashion</span>
                    <span className={styles.colTitleRenting}>Renting on Exchange</span>
                    <span className={styles.colSubtextRenting}>The circular luxury cloud</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((row) => (
                <tr key={row.feature} className={row.highlight ? styles.highlightRow : ''}>
                  <td className={styles.featureCell}>
                    <span className={styles.featureName}>{row.feature}</span>
                  </td>
                  <td className={styles.buyingCell}>
                    <span className={styles.crossIcon}>✕</span>
                    <span className={styles.cellText}>{row.buying}</span>
                  </td>
                  <td className={styles.rentingCell}>
                    <span className={styles.checkIcon}>✓</span>
                    <strong className={styles.rentingText}>{row.renting}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className={styles.ctaRow}>
          <Link to="/listings?rental=true" className={styles.primaryBtn}>
            Rent For Your Next Event →
          </Link>
          <span className={styles.ctaGuarantee}>
            ✦ Free backup size included with every order • Doorstep delivery across India
          </span>
        </div>
      </div>
    </section>
  );
}
