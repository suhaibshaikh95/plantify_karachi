// Top of a step page: back link, optional action on the right, title and subtitle.
import { Link } from 'react-router-dom';
import Icon from '../ui/Icon';
import styles from './PageHeader.module.css';

export default function PageHeader({ backTo, backLabel = 'Back', title, subtitle, action, children }) {
  return (
    <div className={styles.header}>
      {(backTo || action) && (
        <div className={styles.toolbar}>
          {backTo ? (
            <Link to={backTo} className={styles.back}>
              <Icon name="back" size={18} />
              <span>{backLabel}</span>
            </Link>
          ) : (
            <span />
          )}
          {action}
        </div>
      )}
      {children}
      {title && <h1 className={styles.title}>{title}</h1>}
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}
