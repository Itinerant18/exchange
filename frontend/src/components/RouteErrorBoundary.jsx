import { useRouteError, Link } from 'react-router-dom';

export function RouteErrorBoundary() {
  const error = useRouteError();
  const errorMessage = error?.statusText || error?.message || 'An unexpected error occurred.';

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#570020',
      color: '#FFFFFF',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      textAlign: 'center',
      fontFamily: 'inherit',
    }}>
      <span style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C8A251', marginBottom: '0.75rem' }}>
        ✦ Closet in the Cloud ✦
      </span>
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2.25rem', margin: '0 0 1rem', fontWeight: 600 }}>
        An Unexpected Runway Pause
      </h1>
      <p style={{ color: '#E0D6D9', maxWidth: '520px', lineHeight: 1.6, marginBottom: '2rem' }}>
        {errorMessage}
      </p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'transparent',
            border: '1px solid #C8A251',
            color: '#FFFFFF',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Reload Page
        </button>
        <Link
          to="/listings"
          style={{
            padding: '0.75rem 1.5rem',
            background: '#C8A251',
            color: '#1A1A1A',
            borderRadius: '4px',
            textDecoration: 'none',
            fontWeight: 600,
          }}
        >
          Return to Catalog
        </Link>
      </div>
    </div>
  );
}
