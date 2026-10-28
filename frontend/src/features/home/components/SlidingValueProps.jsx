import styles from './SlidingValueProps.module.css';

const STEPS = [
  {
    step: '01',
    title: 'Reserve with Backup Confidence',
    desc: 'Select your event dates (4 or 8 days). Every single garment rental includes a complimentary second backup size at zero extra charge to guarantee the perfect fit.',
    icon: '✦',
  },
  {
    step: '02',
    title: 'Wear & Own the Moment',
    desc: 'Receive pristine, atelier-prepared designer wear delivered directly to your door in our reusable garment satchel, ready to celebrate weddings, galas, and soirées.',
    icon: '★',
  },
  {
    step: '03',
    title: 'Effortless Prepaid Return',
    desc: 'When your event concludes, place both sizes back in the prepaid return bag and schedule a courier pickup. Zero dry cleaning, ironing, or laundering required — we handle it all.',
    icon: '↺',
  },
];

export function SlidingValueProps() {
  return (
    <section className={styles.section} aria-label="How Exchange Works">
      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.eyebrow}>THE CLOSET IN THE CLOUD</span>
          <h2 className={styles.heading}>How Rental Works</h2>
          <p className={styles.subheading}>More fashion, zero commitment, zero closet clutter.</p>
        </div>

        <div className={styles.cardsGrid}>
          {STEPS.map((item) => (
            <div key={item.step} className={styles.card}>
              <div className={styles.cardTop}>
                <span className={styles.stepNum}>{item.step}</span>
                <span className={styles.icon}>{item.icon}</span>
              </div>
              <h3 className={styles.title}>{item.title}</h3>
              <p className={styles.desc}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
