import { useState } from 'react';
import styles from './PincodeTransitCalculator.module.css';

const METRO_PREFIXES = ['11', '12', '13', '20', '40', '41', '50', '56', '60', '70', '38'];

export function PincodeTransitCalculator({ deliveryDate, returnDate }) {
  const [pincode, setPincode] = useState('');
  const [result, setResult] = useState(null);

  const checkPincode = (e) => {
    e.preventDefault();
    const cleanPin = pincode.trim().replace(/\D/g, '');
    if (cleanPin.length !== 6) {
      setResult({ valid: false, message: 'Please enter a valid 6-digit Indian PIN code.' });
      return;
    }

    const prefix = cleanPin.substring(0, 2);
    const isMetro = METRO_PREFIXES.includes(prefix);

    setResult({
      valid: true,
      pincode: cleanPin,
      isMetro,
      speed: isMetro ? 'Metro Express (24–36 Hours)' : 'National Air Express (48 Hours)',
      deliveryBuffer: 'Arrives 1 day prior to your event by 12:00 PM',
      returnBuffer: 'Prepaid courier pickup scheduled on return date',
      courierFee: 'Complimentary (Included in Rental)',
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={styles.icon}>📍</span>
        <div>
          <span className={styles.title}>Delivery & Return Turnaround</span>
          <p className={styles.subtext}>Check courier transit speeds to your doorstep</p>
        </div>
      </div>

      <form onSubmit={checkPincode} className={styles.inputForm}>
        <input
          type="text"
          maxLength={6}
          placeholder="Enter 6-digit PIN code"
          value={pincode}
          onChange={(e) => setPincode(e.target.value)}
          className={styles.pinInput}
        />
        <button type="submit" className={styles.checkBtn}>
          Check
        </button>
      </form>

      {result && (
        <div className={`${styles.resultBox} ${result.valid ? styles.resultSuccess : styles.resultError}`}>
          {result.valid ? (
            <>
              <div className={styles.speedRow}>
                <span className={styles.speedBadge}>{result.speed}</span>
                <span className={styles.freeBadge}>₹0 Shipping</span>
              </div>
              <ul className={styles.timelineList}>
                <li>
                  <strong>Arrival:</strong> {result.deliveryBuffer}
                </li>
                <li>
                  <strong>Return:</strong> {result.returnBuffer}
                </li>
                <li>
                  <strong>Packaging:</strong> Dispatched in reusable weather-resistant atelier satchel with tamper-evident seal.
                </li>
              </ul>
            </>
          ) : (
            <p className={styles.errorText}>{result.message}</p>
          )}
        </div>
      )}
    </div>
  );
}
