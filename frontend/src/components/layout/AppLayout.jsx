// Page frame: sticky frosted header + the current page + footer.
import { Link, Outlet, useLocation } from 'react-router-dom';
import { ROUTES } from '../../constants/routes';
import { useSavedPlan } from '../../hooks/useSavedPlan';
import Icon from '../ui/Icon';
import Button from '../ui/Button';
import styles from './AppLayout.module.css';

export default function AppLayout() {
  const { pathname } = useLocation();
  const { saved } = useSavedPlan();
  const inFlow = [ROUTES.location, ROUTES.questions].includes(pathname);
  const isChat = pathname === ROUTES.chat; // full-height chat: no footer

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={`container ${styles.headerInner}`}>
          <Link to={ROUTES.home} className={styles.brand}>
            <span className={styles.logo}>
              <Icon name="leaf" size={18} strokeWidth={2} />
            </span>
            <span>
              Plantify <span className={styles.brandCity}>Karachi</span>
            </span>
          </Link>
          <nav className={styles.nav} aria-label="Main">
            {saved && (
              <Link to={`${ROUTES.results}?saved=1`} className={styles.navLink}>
                <Icon name="bookmark" size={16} />
                <span>Saved plan</span>
              </Link>
            )}
            {!inFlow && (
              <Button to={ROUTES.location} size="sm" className={styles.cta}>
                Find my plants
              </Button>
            )}
          </nav>
        </div>
      </header>

      <main className={`${styles.main} ${isChat ? styles.mainChat : ''}`}>
        <Outlet />
      </main>

      {!isChat && (
        <footer className={styles.footer}>
          <div className="container">
            <p>Plantify Karachi · Plant suggestions from mapped soil, salt and climate data, not a soil test.</p>
          </div>
        </footer>
      )}
    </div>
  );
}
