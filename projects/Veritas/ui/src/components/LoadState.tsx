import type { ReactNode } from 'react';

export function LoadState({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: string | null;
  children: ReactNode;
}) {
  if (loading) return <div className="loading">Loading…</div>;
  if (error) {
    const offline =
      /failed to fetch|networkerror|load failed|econnrefused/i.test(error) ||
      error.includes('NetworkError');
    return (
      <div className="error-box">
        <strong>{offline ? 'Control plane offline' : 'Request failed'}</strong>
        <p style={{ margin: '8px 0 0' }}>{error}</p>
        {offline && (
          <p style={{ margin: '12px 0 0' }} className="mono">
            cargo run -p veritas-api
          </p>
        )}
      </div>
    );
  }
  return <>{children}</>;
}
