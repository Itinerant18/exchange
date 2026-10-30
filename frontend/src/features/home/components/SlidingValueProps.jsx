import styles from './SlidingValueProps.module.css';

const STEPS = [
  {
    step: '01',
    title: 'Reserve 2 Sizes for Your Event',
    desc: 'Select your event dates (4 or 8 days). Every garment rental includes a complimentary second backup size at zero extra charge to guarantee the perfect fit.',
    image: '/animations/step-choose.gif',
    imageAlt: 'Animation of selecting luxury garments',
  },
  {
    step: '02',
    title: 'Arrives Fresh & Custom-Fitted',
    desc: 'Your ensemble arrives steam-sanitized, 7-stage ozone sterilized, and custom-basted by master tailors to your measurements with ₹299 Festive Care protection included.',
    image: '/animations/step-wear.gif',
    imageAlt: 'Animation of celebrating in occasion wear',
  },
  {
    step: '03',
    title: 'Doorstep Return, Zero Cleaning',
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
