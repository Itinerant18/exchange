import { useEffect, useRef, useState } from 'react';
import { appConfig } from '../../../config/appConfig.js';
import styles from '../pages/AuthPages.module.css';

export function OAuthButtons({ onGoogleSuccess, onAppleSuccess, onError, turnstileToken }) {
  const [googleBusy, setGoogleBusy] = useState(false);
  const [appleBusy, setAppleBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const googleBtnContainerRef = useRef(null);

  // 1. Google Identity Services Initialization
  useEffect(() => {
    let script = document.getElementById('google-gsi-script');
    if (!script) {
      script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const initGsi = () => {
      if (window.google?.accounts?.id && appConfig.googleClientId) {
        try {
          window.google.accounts.id.initialize({
            client_id: appConfig.googleClientId,
            callback: async (response) => {
              if (response.credential) {
                setGoogleBusy(true);
                setNotice('');
                try {
                  await onGoogleSuccess(response.credential, turnstileToken);
                } catch (err) {
                  if (onError) onError(err);
                } finally {
                  setGoogleBusy(false);
                }
              }
            },
          });

          // Render native Google button if container is mounted
          if (googleBtnContainerRef.current) {
            window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
              type: 'standard',
              theme: 'outline',
              size: 'large',
              text: 'continue_with',
              shape: 'rectangular',
              logo_alignment: 'left',
              width: 320,
            });
          }
        } catch (e) {
          console.warn('[GoogleAuth] Initialization note:', e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initGsi();
    } else {
      script.addEventListener('load', initGsi);
    }

    return () => {
      script?.removeEventListener('load', initGsi);
    };
  }, [onGoogleSuccess, onError, turnstileToken]);

  // 2. Apple Sign-In JS SDK Initialization
  useEffect(() => {
    let script = document.getElementById('apple-auth-script');
    if (!script) {
      script = document.createElement('script');
      script.id = 'apple-auth-script';
      script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/auth.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    const initApple = () => {
      if (window.AppleID?.auth && appConfig.appleClientId) {
        try {
          window.AppleID.auth.init({
            clientId: appConfig.appleClientId,
            scope: 'name email',
            redirectURI: window.location.origin,
            usePopup: true,
          });
        } catch (e) {
          console.warn('[AppleAuth] Initialization note:', e);
        }
      }
    };

    if (window.AppleID?.auth) {
      initApple();
    } else {
      script.addEventListener('load', initApple);
    }

    return () => {
      script?.removeEventListener('load', initApple);
    };
  }, []);

  const handleGoogleClick = () => {
    setNotice('');
    if (!appConfig.googleClientId) {
      setNotice('Google Client ID is not configured yet in this environment. Set VITE_GOOGLE_CLIENT_ID to activate.');
      return;
    }

    if (window.google?.accounts?.id) {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // If One Tap is skipped or blocked, focus on native button or notify
          setNotice('Please use the Google Sign-In prompt or verify third-party cookies.');
        }
      });
    } else {
      setNotice('Loading Google Sign-In service. Please try again in a moment.');
    }
  };

  const handleAppleClick = async () => {
    setNotice('');
    if (!appConfig.appleClientId) {
      setNotice('Apple Client ID is not configured yet in this environment. Set VITE_APPLE_CLIENT_ID to activate.');
      return;
    }

    if (!window.AppleID?.auth) {
      setNotice('Apple Sign-In is loading. Please try again in a moment.');
      return;
    }

    setAppleBusy(true);
    try {
      const response = await window.AppleID.auth.signIn();
      if (response?.authorization?.id_token) {
        await onAppleSuccess(
          {
            idToken: response.authorization.id_token,
            user: response.user,
            code: response.authorization.code,
            turnstileToken,
          },
        );
      }
    } catch (err) {
      if (err?.error !== 'popup_closed_by_user') {
        if (onError) onError(err);
      }
    } finally {
      setAppleBusy(false);
    }
  };

  return (
    <div className={styles.oauthContainer}>
      <div className={styles.oauthDivider}>
        <span className={styles.oauthDividerLine} />
        <span className={styles.oauthDividerText}>or continue with</span>
        <span className={styles.oauthDividerLine} />
      </div>

      {notice && (
        <p className={styles.oauthNotice} role="status">
          {notice}
        </p>
      )}

      <div className={styles.oauthButtons}>
        {/* Render container for Google official button if client ID is configured */}
        {appConfig.googleClientId ? (
          <div className={styles.googleBtnWrapper}>
            <div ref={googleBtnContainerRef} className={styles.googleNativeContainer} />
          </div>
        ) : (
          <button
            type="button"
            className={styles.oauthBtn}
            onClick={handleGoogleClick}
            disabled={googleBusy || appleBusy}
            aria-label="Continue with Google"
          >
            <span className={styles.oauthBtnIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            </span>
            <span>{googleBusy ? 'Connecting to Google…' : 'Continue with Google'}</span>
          </button>
        )}

        <button
          type="button"
          className={`${styles.oauthBtn} ${styles.oauthBtnApple} ${styles.oauthBtnDisabled}`}
          disabled
          aria-label="Continue with Apple (Coming Soon)"
          title="Sign in with Apple is coming soon"
        >
          <span className={styles.oauthBtnIcon}>
            <svg width="18" height="18" viewBox="0 0 170 170" fill="currentColor" aria-hidden="true">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.59-7.71-11.72-14-4.89-7.4-8.87-15.66-11.95-24.76-3.08-9.11-4.63-18.06-4.63-26.85 0-12.72 3.18-23.47 9.53-32.23 6.35-8.77 14.36-13.24 24.03-13.43 4.89 0 10.23 1.25 16.02 3.76 5.79 2.5 9.73 3.82 11.83 3.94 1.89-.12 6.08-1.5 12.59-4.14 6.51-2.64 12.18-3.79 17.01-3.46 12.7.63 22.75 5.25 30.15 13.88-11.05 6.74-16.45 16.05-16.19 27.93.26 9.4 3.84 17.27 10.74 23.6 6.9 6.33 15.08 10.02 24.54 11.07-2.01 6.13-4.55 12.28-7.61 18.46zM119.22 31.86c0-7.39 2.65-14.28 7.95-20.67 5.3-6.4 11.8-10.42 19.5-12.07.13 1.14.2 2.16.2 3.06 0 7.39-2.78 14.45-8.34 21.18-5.56 6.73-12.19 10.63-19.89 11.7-.13-1.01-.2-2.08-.2-3.2z" />
            </svg>
          </span>
          <span className={styles.oauthBtnLabel}>Continue with Apple</span>
          <span className={styles.comingSoonBadge}>Coming Soon</span>
        </button>
      </div>
    </div>
  );
}

