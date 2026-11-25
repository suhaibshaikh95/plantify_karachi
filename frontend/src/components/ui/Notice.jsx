// Inline message box for info, warnings and errors, with an optional action button.
import Icon from './Icon';
import Button from './Button';
import styles from './Notice.module.css';

const ICONS = { info: 'sun', warning: 'alert', error: 'alert', success: 'check' };

export default function Notice({ tone = 'info', title, children, actionLabel, onAction, className = '' }) {
  return (
    <div className={`${styles.notice} ${styles[tone]} ${className}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={ICONS[tone]} size={20} className={styles.icon} />
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.text}>{children}</div>}
        {actionLabel && (
          <Button variant="secondary" size="sm" icon="refresh" onClick={onAction} className={styles.action}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
