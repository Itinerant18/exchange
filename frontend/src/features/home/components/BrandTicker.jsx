import styles from './BrandTicker.module.css';

const BRAND_ITEMS = [
  { type: 'logo', name: 'Sabyasachi', src: '/brands/sabyasachi.svg', alt: 'Sabyasachi Haute Couture' },
  { type: 'badge', text: 'CHOOSE FROM' },
  { type: 'logo', name: 'Staud', src: '/brands/staud.png', alt: 'Staud Luxury' },
  { type: 'badge', text: '750+ DESIGNER ARCHIVES' },
  { type: 'logo', name: 'Manish Malhotra', src: '/brands/manish-malhotra.svg', alt: 'Manish Malhotra Couture' },
  { type: 'badge', text: 'HUNDREDS OF YOUR' },
  { type: 'logo', name: 'Sandro', src: '/brands/sandro.png', alt: 'Sandro Paris' },
  { type: 'badge', text: 'FAVORITE ATELIERS' },
  { type: 'logo', name: 'Anita Dongre', src: '/brands/anita-dongre.svg', alt: 'Anita Dongre' },
  { type: 'badge', text: 'ROTATE YOUR WARDROBE' },
  { type: 'logo', name: 'Veronica Beard', src: '/brands/veronica-beard.png', alt: 'Veronica Beard' },
  { type: 'badge', text: 'FREE BACKUP SIZE' },
  { type: 'logo', name: 'Tarun Tahiliani', src: '/brands/tarun-tahiliani.svg', alt: 'Tarun Tahiliani' },
  { type: 'badge', text: 'PRE-LOVED & RENTALS' },
  { type: 'logo', name: 'Reformation', src: '/brands/reformation.png', alt: 'Reformation' },
  { type: 'badge', text: 'CIRCULAR LUXURY' },
  { type: 'logo', name: 'Raw Mango', src: '/brands/raw-mango.svg', alt: 'Raw Mango' },
  { type: 'badge', text: 'AUTHENTICATED COUTURE' },
  { type: 'logo', name: 'Simkhai', src: '/brands/simkhai.png', alt: 'Simkhai' },
  { type: 'badge', text: 'COMPLIMENTARY ECO CLEANING' },
  { type: 'logo', name: 'Ulla Johnson', src: '/brands/ulla-johnson.png', alt: 'Ulla Johnson' },
];

export function BrandTicker() {
  return (
    <div className={styles.tickerWrapper} aria-label="Featured Designer Brands">
      <div className={styles.tickerTrack}>
        {[...BRAND_ITEMS, ...BRAND_ITEMS].map((item, idx) => (
          <div key={`${item.name || item.text}-${idx}`} className={styles.tickerItem}>
            {item.type === 'logo' ? (
              <img
                src={item.src}
                alt={item.alt}
                className={styles.brandLogo}
                loading="lazy"
              />
            ) : (
              <span className={styles.typographicBadge}>
                {item.text}
              </span>
            )}
            <span className={styles.sparkle}>✦</span>
          </div>
        ))}
      </div>
    </div>
  );
}
