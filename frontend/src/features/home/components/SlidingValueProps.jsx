import styles from './SlidingValueProps.module.css';

const STEPS = [
  {
    step: '01',
    title: 'Reserve 2 Sizes for Your Event',
    desc: 'Select your event dates (4 or 8 days). Every garment rental includes a complimentary second backup size at zero extra charge to guarantee the perfect fit.',
    image: '/animations/step-choose.gif',
    imageAlt: 'Animation of designer clothes hanging on line',
  },
  {
    step: '02',
    title: 'Wear & Own the Moment',
    desc: 'Receive pristine, atelier-prepared designer wear delivered directly to your door in our weather-resistant satchel, ready to celebrate weddings, galas, and soirées.',
    image: '/animations/step-wear.gif',
    imageAlt: 'Animation of celebrating occasion wear',
  },
  {
    step: '03',
    title: 'Prepaid Return, Zero Cleaning',
    desc: 'When your event concludes, place both sizes back in the prepaid return satchel and schedule a courier pickup. Zero dry cleaning or laundering required — we handle it all.',
    image: '/animations/step-return.gif',
    imageAlt: 'Animation of returning garments in reusable satchel',
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
              <div className={styles.imageBox}>
                <img
                  src={item.image}
                  alt={item.imageAlt}
                  className={styles.animationImg}
                  loading="lazy"
                />
                <span className={styles.stepNum}>{item.step}</span>
              </div>
              <div className={styles.cardBody}>
                <h3 className={styles.title}>{item.title}</h3>
                <p className={styles.desc}>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
