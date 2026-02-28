import styles from './ErrorBanner.module.css';

interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div role="alert" className={styles.errorBanner}>
      <span className={styles.icon} aria-hidden="true">
        &#9888;
      </span>
      <span className={styles.text}>{message}</span>
    </div>
  );
}
