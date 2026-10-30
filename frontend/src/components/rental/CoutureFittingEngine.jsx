import { useState } from 'react';
import styles from './CoutureFittingEngine.module.css';

export function CoutureFittingEngine({ onFittingChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [bust, setBust] = useState('Default');
  const [waist, setWaist] = useState('Default');
  const [length, setLength] = useState('Standard');
  const [heelHeight, setHeelHeight] = useState('Flats (0 in)');
  const [paddingPref, setPaddingPref] = useState('Keep');
  const [specialNotes, setSpecialNotes] = useState('');

  const handleUpdate = (field, value) => {
    const updated = {
      bust: field === 'bust' ? value : bust,
      waist: field === 'waist' ? value : waist,
      length: field === 'length' ? value : length,
      heelHeight: field === 'heelHeight' ? value : heelHeight,
      paddingPref: field === 'paddingPref' ? value : paddingPref,
      specialNotes: field === 'specialNotes' ? value : specialNotes,
    };
    if (field === 'bust') setBust(value);
    if (field === 'waist') setWaist(value);
    if (field === 'length') setLength(value);
    if (field === 'heelHeight') setHeelHeight(value);
    if (field === 'paddingPref') setPaddingPref(value);
    if (field === 'specialNotes') setSpecialNotes(value);

    if (onFittingChange) onFittingChange(updated);
  };

  const isCustomized = bust !== 'Default' || waist !== 'Default' || length !== 'Standard' || (heelHeight !== 'Flats (0 in)' && heelHeight !== 'Flats (0")') || specialNotes.trim() !== '';

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={`${styles.toggleHeader} ${isOpen ? styles.toggleHeaderActive : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className={styles.headerLeft}>
          <span className={styles.sparkleIcon}>✦</span>
          <div>
            <div className={styles.titleRow}>
              <span className={styles.title}>Complimentary Basting & Custom Fit</span>
              <span className={styles.freeBadge}>Free (₹0)</span>
            </div>
            <p className={styles.subtitle}>
              {isCustomized ? '✓ Custom tailoring specifications applied' : 'Reversible blouse & lehenga adjustments before dispatch'}
            </p>
          </div>
        </div>
        <span className={styles.arrowIcon}>{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className={styles.body}>
          <p className={styles.disclaimer}>
            Our master atelier tailors adjust in-built seam margins with reversible hand-basting stitches. The garment is tailored to your measurements without permanent cuts, ensuring pristine preservation.
          </p>

          <div className={styles.grid}>
            {/* Blouse Bust */}
            <div className={styles.field}>
              <label className={styles.label}>Blouse Bust</label>
              <select
                className={styles.select}
                value={bust}
                onChange={(e) => handleUpdate('bust', e.target.value)}
              >
                <option value="Default">Standard Fit (As Listed)</option>
                <option value="32 in">32 inches (Bust)</option>
                <option value="34 in">34 inches (Bust)</option>
                <option value="36 in">36 inches (Bust)</option>
                <option value="38 in">38 inches (Bust)</option>
                <option value="40 in">40 inches (Bust)</option>
                <option value="42 in">42 inches (Bust)</option>
              </select>
            </div>

            {/* Blouse Waist */}
            <div className={styles.field}>
              <label className={styles.label}>Blouse Waist</label>
              <select
                className={styles.select}
                value={waist}
                onChange={(e) => handleUpdate('waist', e.target.value)}
              >
                <option value="Default">Standard Fit (As Listed)</option>
                <option value="26 in">26 inches (Underbust)</option>
                <option value="28 in">28 inches (Underbust)</option>
                <option value="30 in">30 inches (Underbust)</option>
                <option value="32 in">32 inches (Underbust)</option>
                <option value="34 in">34 inches (Underbust)</option>
                <option value="36 in">36 inches (Underbust)</option>
              </select>
            </div>

            {/* Lehenga / Skirt Length */}
            <div className={styles.field}>
              <label className={styles.label}>Skirt / Lehenga Length</label>
              <select
                className={styles.select}
                value={length}
                onChange={(e) => handleUpdate('length', e.target.value)}
              >
                <option value="Standard">Standard (~42 inches)</option>
                <option value="Petite">Petite Hem (~40 inches)</option>
                <option value="Tall">Tall Hem (~44 inches)</option>
              </select>
            </div>

            {/* Heel Offset */}
            <div className={styles.field}>
              <label className={styles.label}>Planned Footwear / Heels</label>
              <select
                className={styles.select}
                value={heelHeight}
                onChange={(e) => handleUpdate('heelHeight', e.target.value)}
              >
                <option value="Flats (0 in)">Flats / Juttis (0")</option>
                <option value="Kitten Heels (1.5-2 in)">Kitten Heels (1.5" - 2")</option>
                <option value="Stilettos (3-4 in)">High Heels / Stilettos (3" - 4")</option>
              </select>
            </div>
          </div>

          {/* Padding Preference */}
          <div className={styles.radioGroup}>
            <span className={styles.label}>Blouse Padding Preference:</span>
            <div className={styles.radioOptions}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="padding"
                  checked={paddingPref === 'Keep'}
                  onChange={() => handleUpdate('paddingPref', 'Keep')}
                />
                Keep Atelier Cups
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name="padding"
                  checked={paddingPref === 'Remove'}
                  onChange={() => handleUpdate('paddingPref', 'Remove')}
                />
                Remove Padding
              </label>
            </div>
          </div>

          {/* Special Atelier Notes */}
          <div className={styles.fieldFull}>
            <label className={styles.label}>Special Fitting Instructions (Optional)</label>
            <input
              type="text"
              className={styles.textInput}
              placeholder="e.g., Slightly relaxed armhole, extra margin at ribcage..."
              value={specialNotes}
              onChange={(e) => handleUpdate('specialNotes', e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
