import styles from "./PortraitPrompt.module.css";

// CSS-only: the prompt is hidden by default and only shown on narrow portrait
// viewports via media query. No JS needed — rotating the device auto-hides it.
export function PortraitPrompt() {
  return (
    <div className={styles.prompt} role="alertdialog" aria-live="polite">
      <div className={styles.inner}>
        <div className={styles.icon} aria-hidden="true">
          ⟳
        </div>
        <p className={styles.title}>ROTATE DEVICE</p>
        <p className={styles.sub}>
          Landscape orientation is recommended for cube solving.
        </p>
      </div>
    </div>
  );
}
