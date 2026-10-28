import styles from './BackupSizeSelector.module.css';

const DEFAULT_SIZES = ['XS', 'S', 'M', 'L', 'XL'];

export function BackupSizeSelector({
  sizes = DEFAULT_SIZES,
  primarySize,
  onPrimarySizeChange,
  backupSize,
  onBackupSizeChange,
  onOpenSizeGuide,
}) {
  return (
    <div className={styles.container}>
      {/* ── Primary Size Row ── */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <span className={styles.label}>1. Select Primary Size</span>
          {primarySize && <span className={styles.selectedIndicator}>({primarySize})</span>}
        </div>
        {onOpenSizeGuide && (
          <button type="button" onClick={onOpenSizeGuide} className={styles.guideLink}>
            Size Guide
          </button>
        )}
      </div>

      <div className={styles.chipsRow} role="radiogroup" aria-label="Primary size selection">
        {sizes.map((size) => (
          <button
            key={`primary-${size}`}
            type="button"
            className={`${styles.sizeChip} ${primarySize === size ? styles.sizeChipActive : ''}`}
            onClick={() => {
              onPrimarySizeChange(size);
              // Clear backup size if it matches the new primary size
              if (backupSize === size) {
                onBackupSizeChange('');
              }
            }}
            role="radio"
            aria-checked={primarySize === size}
          >
            {size}
          </button>
        ))}
      </div>

      {/* ── Free Backup Size Row ── */}
      <div className={styles.backupSection}>
        <div className={styles.backupHeader}>
          <div className={styles.backupTitleGroup}>
            <span className={styles.label}>2. Select Free Backup Size</span>
            <span className={styles.freeBadge}>FREE COMPLIMENTARY</span>
          </div>
          <span className={styles.backupTip}>Sent in the same delivery</span>
        </div>

        <div className={styles.chipsRow} role="radiogroup" aria-label="Backup size selection">
          <button
            type="button"
            className={`${styles.sizeChip} ${!backupSize ? styles.sizeChipActive : ''}`}
            onClick={() => onBackupSizeChange('')}
            role="radio"
            aria-checked={!backupSize}
          >
            None
          </button>

          {sizes.map((size) => {
            const isSameAsPrimary = primarySize === size;
            return (
              <button
                key={`backup-${size}`}
                type="button"
                disabled={isSameAsPrimary}
                className={`${styles.sizeChip} ${backupSize === size ? styles.sizeChipActive : ''} ${
                  isSameAsPrimary ? styles.sizeChipDisabled : ''
                }`}
                onClick={() => onBackupSizeChange(size)}
                role="radio"
                aria-checked={backupSize === size}
                title={isSameAsPrimary ? 'Cannot be identical to primary size' : `Select size ${size} as backup`}
              >
                {size}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
