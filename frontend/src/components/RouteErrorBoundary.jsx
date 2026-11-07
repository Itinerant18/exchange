import { useRouteError, Link } from 'react-router-dom';
import { appConfig } from '../config/appConfig.js';
import { resolveErrorMessage } from '../config/errorMessages.js';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const is404 = error?.status === 404;
  const resolved = resolveErrorMessage(error);
  const requestId = error?.requestId || error?.response?.headers?.get?.('x-request-id') || null;

  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: '#570020',
        color: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2.5rem 1.5rem',
        textAlign: 'center',
        fontFamily: 'var(--font-body, -apple-system, BlinkMacSystemFont, sans-serif)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative luxury radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(200, 162, 81, 0.12) 0%, rgba(87, 0, 32, 0) 70%)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      {/* Brand Monogram */}
      <Link
        to="/"
        style={{
          textDecoration: 'none',
          color: '#C8A251',
          fontSize: '0.8125rem',
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          marginBottom: '1.25rem',
          fontWeight: 600,
        }}
      >
        ✦ {appConfig.name} ✦
      </Link>

      {/* Editorial Headline */}
      <h1
        style={{
          fontFamily: 'var(--font-display, Playfair Display, serif)',
          fontSize: 'clamp(2rem, 5vw, 3rem)',
          margin: '0 0 1rem',
          fontWeight: 400,
          letterSpacing: '-0.02em',
          color: '#FFFFFF',
          maxWidth: '680px',
          lineHeight: 1.15,
        }}
      >
        {is404 ? 'Look Not Located' : 'An Unexpected Runway Pause'}
      </h1>

      {/* Calm, Reassuring Explanation */}
      <p
        style={{
          color: '#E0D6D9',
          maxWidth: '540px',
          lineHeight: 1.65,
          fontSize: '1rem',
          margin: '0 0 2rem',
          fontWeight: 300,
        }}
      >
        {is404
          ? 'The designer archive, look, or page you requested cannot be found. It may have moved or concluded its exhibition.'
          : resolved.message}
      </p>

      {/* Correlation Reference for Support */}
      {requestId && (
        <p
          style={{
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            color: 'rgba(255, 255, 255, 0.5)',
            marginBottom: '2rem',
            letterSpacing: '0.05em',
          }}
        >
          Reference ID: {requestId}
        </p>
      )}

      {/* Guided Recovery Actions */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 28px',
            background: 'transparent',
            border: '1px solid rgba(200, 162, 81, 0.6)',
            color: '#FFFFFF',
            borderRadius: '9999px',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            transition: 'all 0.2s ease',
          }}
        >
          Reload Runway
        </button>

        <Link
          to="/listings"
          style={{
            padding: '12px 28px',
            background: '#C8A251',
            color: '#1A1A1A',
            borderRadius: '9999px',
            textDecoration: 'none',
            fontSize: '0.8125rem',
            fontWeight: 600,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
          }}
        >
          Return to Catalog
        </Link>
      </div>
    </div>
  );
}
