import styles from './NoDiffMessage.module.css';

export function NoDiffMessage() {
  return (
    <div role="status" className={styles.noDiffMessage}>
      <span className={styles.icon} aria-hidden="true">
        &#10003;
      </span>
      <span className={styles.text}>
        No differences found — both JSON inputs are identical after formatting and
        key sorting.
      </span>
    </div>
  );
}
