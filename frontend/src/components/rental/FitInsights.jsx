import styles from './FitInsights.module.css';

export function FitInsights({
  size,
  colour,
  condition,
  brand,
  fitStats,
  fitNotes,
}) {
  const hasFitStats = fitStats && fitStats.totalRatings > 0;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h4 className={styles.title}>Atelier Sizing & Fit Intel</h4>
          <span className={styles.sub}>
            {hasFitStats
              ? `Based on ${fitStats.totalRatings} verified customer rentals`
              : 'Verified atelier garment specifications'}
          </span>
        </div>
      </div>

      {/* ── Visual Fit Distribution Bar (Only rendered if authentic customer survey data exists) ── */}
      {hasFitStats && (
        <div className={styles.meterContainer}>
          <div className={styles.meterLabels}>
            <span>Runs Small ({fitStats.runsSmall}%)</span>
            <span className={styles.trueToSizeLabel}>True to Size ({fitStats.trueToSize}%)</span>
            <span>Runs Large ({fitStats.runsLarge}%)</span>
          </div>

          <div className={styles.bar}>
            <div
              className={styles.segmentSmall}
              style={{ width: `${fitStats.runsSmall}%` }}
              title={`Runs Small: ${fitStats.runsSmall}%`}
            />
            <div
              className={styles.segmentTrue}
              style={{ width: `${fitStats.trueToSize}%` }}
              title={`True to Size: ${fitStats.trueToSize}%`}
            />
            <div
              className={styles.segmentLarge}
              style={{ width: `${fitStats.runsLarge}%` }}
              title={`Runs Large: ${fitStats.runsLarge}%`}
            />
          </div>
        </div>
      )}

      {/* ── Garment Specifications ── */}
      <div className={styles.specsList}>
        {size && (
          <div className={styles.specRow}>
            <span className={styles.specKey}>Atelier Tag Size</span>
            <span className={styles.specVal}>{size}</span>
          </div>
        )}
        {colour && (
          <div className={styles.specRow}>
            <span className={styles.specKey}>Color / Palette</span>
            <span className={styles.specVal}>{colour}</span>
          </div>
        )}
        {condition && (
          <div className={styles.specRow}>
            <span className={styles.specKey}>Condition Grade</span>
            <span className={styles.specVal}>{condition}</span>
          </div>
        )}
        {brand && (
          <div className={styles.specRow}>
            <span className={styles.specKey}>Designer Cut</span>
            <span className={styles.specVal}>{brand} Standard Cut</span>
          </div>
        )}
      </div>

      {/* ── Key Spec Advice (Only if genuine fit notes provided) ── */}
      {fitNotes && (
        <div className={styles.notesList}>
          {fitNotes.bust && (
            <div className={styles.noteItem}>
              <strong className={styles.noteKey}>Bust:</strong>
              <span className={styles.noteValue}>{fitNotes.bust}</span>
            </div>
          )}
          {fitNotes.length && (
            <div className={styles.noteItem}>
              <strong className={styles.noteKey}>Length:</strong>
              <span className={styles.noteValue}>{fitNotes.length}</span>
            </div>
          )}
          {fitNotes.stretch && (
            <div className={styles.noteItem}>
              <strong className={styles.noteKey}>Fabric:</strong>
              <span className={styles.noteValue}>{fitNotes.stretch}</span>
            </div>
          )}
        </div>
      )}

      {/* ── Complimentary Backup Size Reassurance ── */}
      <div className={styles.backupNotice}>
        <span className={styles.backupIcon}>✦</span>
        <span>
          <strong>Fit Guarantee:</strong> Every event rental includes a complimentary 2nd backup size option during booking so you can step out with confidence.
        </span>
      </div>
    </div>
  );
}
