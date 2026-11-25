// Button / link-button with variants. Renders a router <Link> when `to` is given.
import { Link } from 'react-router-dom';
import Icon from './Icon';
import styles from './Button.module.css';

export default function Button({
  variant = 'primary', // primary | secondary | ghost
  size = 'md', // md | lg | sm
  to,
  icon,
  iconRight,
  loading = false,
  block = false,
  className = '',
  children,
  ...props
}) {
  const cls = [styles.button, styles[variant], styles[size], block ? styles.block : '', className].join(' ');
  const content = (
    <>
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon && <Icon name={icon} size={18} />}
      <span>{children}</span>
      {iconRight && !loading && <Icon name={iconRight} size={18} />}
    </>
  );
  if (to) {
    return (
      <Link to={to} className={cls} {...props}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...props} disabled={loading || props.disabled} aria-busy={loading || undefined}>
      {content}
    </button>
  );
}
