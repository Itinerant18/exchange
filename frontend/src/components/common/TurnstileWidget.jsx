import { useEffect, useRef } from 'react';
import { appConfig } from '../../config/appConfig.js';

export function TurnstileWidget({
  action = 'general',
  onVerify,
  onError,
  className = '',
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    function renderWidget() {
      if (!window.turnstile || !containerRef.current || cancelled) return;
      if (widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore cleanup errors
        }
      }

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: appConfig.turnstileSiteKey || '0x4AAAAAAF2CZKS04qmu5moS',
          action,
          theme: 'auto',
          size: typeof window !== 'undefined' && window.innerWidth < 360 ? 'compact' : 'flexible',
          callback: (token) => {
            if (!cancelled && onVerify) onVerify(token);
          },
          'error-callback': () => {
            if (!cancelled && onError) onError();
          },
        });
        widgetIdRef.current = id;
      } catch (err) {
        console.warn('[TurnstileWidget] Render error:', err);
      }
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.querySelector('script[src*="turnstile/v0/api.js"]');
      if (!script) {
        script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      const interval = setInterval(() => {
        if (window.turnstile) {
          clearInterval(interval);
          renderWidget();
        }
      }, 100);

      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    return () => {
      cancelled = true;
      if (widgetIdRef.current !== null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore
        }
      }
    };
  }, [action, onVerify, onError]);

  return (
    <div
      ref={containerRef}
      className={`turnstile-container my-3 ${className}`}
      data-testid="turnstile-widget"
    />
  );
}

