// Shown for any unknown URL.
import Button from '../components/ui/Button';
import { ROUTES } from '../constants/routes';
import styles from './NotFoundPage.module.css';

export default function NotFoundPage() {
  return (
    <div className={`container page-enter ${styles.page}`}>
      <p className={styles.code}>404</p>
      <h1>This page doesn’t exist</h1>
      <p className={styles.text}>The link may be old. Start again from the home page.</p>
      <Button to={ROUTES.home}>Go home</Button>
    </div>
  );
}
