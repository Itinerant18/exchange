import { Link } from 'react-router-dom';
import styles from './MoleculeVisualNav.module.css';

const OCCASIONS = [
  {
    title: 'Wedding Guest',
    subtitle: 'Couture Lehengas & Sarees',
    query: 'occasion=WeddingGuest',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=600&q=80',
  },
  {
    title: 'Cocktail & Party',
    subtitle: 'Statement Silhouettes & Minis',
    query: 'occasion=Cocktail',
    image: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=600&q=80',
  },
  {
    title: 'Black Tie Gala',
    subtitle: 'Floor-Length Luxury Gowns',
    query: 'occasion=BlackTie',
    image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80',
  },
  {
    title: 'Vacation & Resort',
    subtitle: 'Breezy Silks & Linens',
    query: 'occasion=Vacation',
    image: 'https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=600&q=80',
  },
  {
    title: 'Festive & Sangeet',
    subtitle: 'Sequins & Mirrorwork Archive',
    query: 'occasion=Festive',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80',
  },
];

export function MoleculeVisualNav() {
  return (
    <div className={styles.visualNavContainer}>
      <div className={styles.headerRow}>
        <div>
          <span className={styles.eyebrow}>CURATED EDITS</span>
          <h2 className={styles.heading}>Rent by Occasion</h2>
        </div>
        <Link to="/listings" className={styles.viewAllLink}>
          View All Edits →
        </Link>
      </div>

      <div className={styles.carouselTrack}>
        {OCCASIONS.map((occ) => (
          <Link
            key={occ.title}
            to={`/listings?${occ.query}`}
            className={styles.tileCard}
          >
            <div className={styles.imageBox}>
              <img src={occ.image} alt={occ.title} className={styles.tileImg} loading="lazy" />
              <div className={styles.tileOverlay} />
            </div>
            <div className={styles.tileCopy}>
              <h3 className={styles.tileTitle}>{occ.title}</h3>
              <p className={styles.tileSubtitle}>{occ.subtitle}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
