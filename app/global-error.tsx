'use client'

/**
 * Replaces the whole document when the root layout itself fails, so it cannot
 * rely on globals.css having loaded. Styles are inline and minimal.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#E8ECE4',
          color: '#17201C',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '32rem' }}>
          <h1 style={{ fontSize: '1.875rem', margin: '0 0 12px', fontWeight: 700 }}>
            Tijori couldn’t start
          </h1>
          <p style={{ margin: '0 0 24px', color: '#55625A', lineHeight: 1.55 }}>
            Something failed before the app finished loading. Your vault is untouched — nothing is
            decrypted until you unlock it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: '44px',
              padding: '0 20px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#2E4A3F',
              color: '#F5F7F2',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
          {error.digest ? (
            <p style={{ marginTop: '24px', fontSize: '0.75rem', color: '#55625A' }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  )
}
