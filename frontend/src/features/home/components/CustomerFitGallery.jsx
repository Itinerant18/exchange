import { useState } from 'react';
import { Link } from 'react-router-dom';
import styles from './CustomerFitGallery.module.css';

const FIT_REELS = [
  {
    id: 'fit-1',
    category: 'bridal',
    title: 'Silk Organza Embroidered Lehenga',
    designer: 'Sabyasachi Archive',
    customerName: 'Pooja K.',
    city: 'New Delhi',
    rating: 5,
    specs: 'Wore M · 5\'6" (168 cm) · Bust 34B · Waist 28"',
    verdict: 'True to Size · Flawless Length',
    review: '“The basting service was a game changer. The blouse felt made-to-measure, and returning it in the pre-paid bag took 30 seconds.”',
    image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
    occasion: 'Brother’s Sangeet Gala',
  },
  {
    id: 'fit-2',
    category: 'gowns',
    title: 'Emerald Cascade Pleated Gown',
    designer: 'Badgley Mischka',
    customerName: 'Ananya S.',
    city: 'Mumbai',
    rating: 5,
    specs: 'Wore S · 5\'7" (170 cm) · Bust 32C · Waist 26"',
    verdict: 'Complimentary Backup Size Saved Me',
    review: '“I ordered S and requested XS as backup. The XS was perfection for my reception dinner. Saved over ₹30,000 vs buying!”',
    image: 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?auto=format&fit=crop&w=800&q=80',
    occasion: 'Black-Tie Reception Gala',
  },
  {
    id: 'fit-3',
    category: 'cocktail',
    title: 'Juliette Floral High-Slit Midi',
    designer: 'Reformation',
    customerName: 'Meera D.',
    city: 'Bengaluru',
    rating: 5,
    specs: 'Wore S · 5\'4" (162 cm) · Bust 32B · Waist 27"',
    verdict: 'Showroom Pristine · Zero Odors',
    review: '“Arrived sealed in a luxury garment bag with hospital-grade sanitization tags. Fresh, crisp, and got dozens of compliments.”',
    image: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=800&q=80',
    occasion: 'Sunset Vineyard Cocktail',
  },
  {
    id: 'fit-4',
    category: 'gowns',
    title: 'Midnight Velvet Column Dress',
    designer: 'Marchesa Notte',
    customerName: 'Rhea M.',
    city: 'Jaipur',
    rating: 5,
    specs: 'Wore L · 5\'8" (173 cm) · Bust 36C · Waist 31"',
    verdict: 'True to Size · Sculpting Boning',
    review: '“The fabric weight and drape are sublime. Having ₹299 Festive Care gave complete peace of mind while dancing all night.”',
    image: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=800&q=80',
    occasion: 'Palace Wedding Sangeet',
  },
];

const CATEGORIES = [
  { id: 'all', label: 'All Runway Looks' },
  { id: 'bridal', label: 'Bridal & Lehengas' },
  { id: 'gowns', label: 'Evening Gowns' },
  { id: 'cocktail', label: 'Cocktail & Party' },
];

export function CustomerFitGallery() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeLightbox, setActiveLightbox] = useState(null);

  const filteredReels = activeCategory === 'all'
    ? FIT_REELS
    : FIT_REELS.filter((item) => item.category === activeCategory);

  return (
    <section className={styles.gallerySection} aria-label="Our Runway Customer Fit Gallery">
      <div className={styles.container}>
        <div className={styles.header}>
          <h2 className={styles.heading}>Our Runway — Real Fits on Real Women</h2>
          <p className={styles.subheading}>
            Unfiltered community photos, verified body measurements, and honest fit verdicts from milestone moments across India.
          </p>
        </div>

        {/* Filter Tabs */}
        <div className={styles.filterTabs}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`${styles.filterBtn} ${activeCategory === cat.id ? styles.filterBtnActive : ''}`}
              onClick={() => setActiveCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 4:3 / 3:4 Cards Grid */}
        <div className={styles.cardsGrid}>
          {filteredReels.map((reel) => (
            <div key={reel.id} className={styles.card}>
              <div
                className={styles.imageFrame}
                onClick={() => setActiveLightbox(reel)}
                role="button"
                tabIndex={0}
                aria-label={`View full fit details for ${reel.title}`}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setActiveLightbox(reel)}
              >
                <img
                  src={reel.image}
                  alt={`${reel.customerName} wearing ${reel.title}`}
                  className={styles.customerImg}
                  loading="lazy"
                />
                <span className={styles.fitBadgePill}>✦ {reel.verdict}</span>
              </div>

              <div className={styles.cardBody}>
                <span className={styles.designerName}>{reel.designer}</span>
                <h3 className={styles.outfitTitle}>{reel.title}</h3>
                
                <div className={styles.specsPill}>
                  <strong>Body Fit:</strong> {reel.specs}
                </div>

                <p className={styles.reviewText}>{reel.review}</p>

                <div className={styles.reviewerMeta}>
                  <span className={styles.reviewerName}>
                    {reel.customerName} · {reel.city}
                  </span>
                  <span className={styles.ratingStars} aria-label={`${reel.rating} out of 5 stars`}>
                    {'★'.repeat(reel.rating)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.actionRow}>
          <Link to="/listings?rental=true" className={styles.exploreAllBtn}>
            Explore All Community Looks →
          </Link>
        </div>
      </div>

      {/* Lightbox Modal */}
      {activeLightbox && (
        <div
          className={styles.lightboxBackdrop}
          onClick={() => setActiveLightbox(null)}
          role="dialog"
          aria-modal="true"
        >
          <div className={styles.lightboxContent} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.lightboxCloseBtn}
              onClick={() => setActiveLightbox(null)}
              aria-label="Close fit review modal"
            >
              ✕
            </button>

            <div className={styles.lightboxImageFrame}>
              <img
                src={activeLightbox.image}
                alt={activeLightbox.title}
                className={styles.lightboxImage}
              />
            </div>

            <div className={styles.lightboxBody}>
              <span className={styles.designerName}>{activeLightbox.designer}</span>
              <h3 className={styles.heading} style={{ fontSize: '24px', margin: 0 }}>
                {activeLightbox.title}
              </h3>
              
              <div className={styles.specsPill}>
                <strong>Occasion:</strong> {activeLightbox.occasion}
              </div>

              <div className={styles.specsPill}>
                <strong>Verified Measurements:</strong><br />
                {activeLightbox.specs}
              </div>

              <div className={styles.specsPill} style={{ background: '#FBEBF0', borderColor: 'rgba(87,0,32,0.15)' }}>
                <strong>Fit Verdict:</strong> ✦ {activeLightbox.verdict}
              </div>

              <p className={styles.reviewText} style={{ fontSize: '14px', lineHeight: 1.6 }}>
                {activeLightbox.review}
              </p>

              <div className={styles.reviewerMeta} style={{ fontSize: '13px' }}>
                <span className={styles.reviewerName}>
                  {activeLightbox.customerName} ({activeLightbox.city}) · Verified Renter
                </span>
                <span className={styles.ratingStars}>{'★'.repeat(activeLightbox.rating)}</span>
              </div>

              <Link
                to="/listings?rental=true"
                className={styles.lightboxCtaBtn}
                onClick={() => setActiveLightbox(null)}
              >
                Browse Similar Designer Looks
              </Link>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
