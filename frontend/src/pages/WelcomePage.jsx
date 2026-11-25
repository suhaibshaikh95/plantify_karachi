// Landing page: what Plantify does and how it works.
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Icon from '../components/ui/Icon';
import { ROUTES } from '../constants/routes';
import styles from './WelcomePage.module.css';

const STEPS = [
  { icon: 'camera', title: 'Upload a photo of the land', text: 'We read the location from it, or you drop a pin.' },
  { icon: 'chat', title: 'Answer 7 simple questions', text: 'Salt signs, water, space, care and purpose.' },
  { icon: 'leaf', title: 'Get your top 6 plants', text: 'Each one with the reasons it suits your plot.' },
];

const POINTS = [
  { icon: 'drop', text: 'Soil salinity and climate of your exact spot' },
  { icon: 'shield', text: 'Unsafe and banned species are filtered out' },
  { icon: 'sun', text: 'Picked for Karachi heat and water' },
];

export default function WelcomePage() {
  return (
    <div className={`container page-enter ${styles.page}`}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>
          <span className={styles.dot} />
          Made for Karachi
        </p>
        <h1 className={styles.title}>
          The right plants
          <br />
          for <span className={styles.highlight}>your plot.</span>
        </h1>
        <p className={styles.lead}>
          Take one photo and answer seven quick questions. We check the soil, salt and climate of your spot and suggest
          six plants that will survive.
        </p>
        <div className={styles.actions}>
          <Button to={ROUTES.location} size="lg" iconRight="arrowRight">
            Get started
          </Button>
          <span className={styles.fine}>No soil test or sensors needed</span>
        </div>
        <ul className={styles.points}>
          {POINTS.map((p) => (
            <li key={p.text}>
              <Icon name={p.icon} size={18} />
              {p.text}
            </li>
          ))}
        </ul>
      </section>

      <aside className={styles.side}>
        <div className={styles.blob} aria-hidden="true" />
        <Card glass className={styles.howCard}>
          <h2 className={styles.howTitle}>How it works</h2>
          <ol className={styles.steps}>
            {STEPS.map((s, i) => (
              <li key={s.title} className={styles.step}>
                <span className={styles.stepIcon}>
                  <Icon name={s.icon} size={20} />
                </span>
                <div>
                  <p className={styles.stepTitle}>
                    <span className={styles.stepNum}>{i + 1}.</span> {s.title}
                  </p>
                  <p className={styles.stepText}>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </aside>
    </div>
  );
}
