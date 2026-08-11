import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, pct } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

const WINDOWS = [
  { id: '15m', label: '15m' },
  { id: '1h', label: '1h' },
  { id: '24h', label: '24h' },
  { id: '7d', label: '7d' },
];

export function WhatChanged() {
  const [window, setWindow] = useState('1h');
  const { data, loading, error } = useApi(() => api.whatChanged(window), [window]);

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="What Changed" topic="whatChanged">
        <select
          className="window-select"
          value={window}
          onChange={(e) => setWindow(e.target.value)}
        >
          {WINDOWS.map((w) => (
            <option key={w.id} value={w.id}>
              {w.label}
            </option>
          ))}
        </select>
      </PageHead>

      <div className="grid grid-3">
        <div className="card">
          <h3>Meaningful</h3>
          <div className="stat soft">{data?.meaningful_changes}</div>
        </div>
        <div className="card">
          <h3>Linked</h3>
          <div className="stat accent">{data?.related_to_degradation}</div>
        </div>
        <div className="card">
          <h3>Window</h3>
          <div className="stat sand mono">{data?.window}</div>
        </div>
      </div>

      {data?.primary && (
        <div className="card section-gap incident-banner">
          <h3>Primary</h3>
          <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{data.primary.summary}</div>
          <div className="mono" style={{ color: 'var(--text-dim)', marginTop: 8 }}>
            {pct(data.primary.correlation, 0)} · {data.primary.source} ·{' '}
            {new Date(data.primary.occurred_at).toLocaleString()}
          </div>
          <div className="section-gap">
            <h3>After</h3>
            <div className="tag-list">
              {data.observed_after.map((o) => (
                <span className="tag" key={o}>
                  {o}
                </span>
              ))}
            </div>
          </div>
          <div className="section-gap">
            <h3>Chain</h3>
            <div className="chain">
              {data.causal_chain.map((node, i) => (
                <span key={node} style={{ display: 'contents' }}>
                  {i > 0 && <span className="chain-arrow">→</span>}
                  <span className="chain-node">{node}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="btn-row section-gap">
            <Link className="btn btn-primary" to="/why">
              Why
            </Link>
          </div>
        </div>
      )}

      <div className="card section-gap">
        <h3>All</h3>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Kind</th>
              <th>Summary</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {(data?.changes ?? []).map((c) => (
              <tr key={c.id}>
                <td className="mono" style={{ color: 'var(--text-mute)' }}>
                  {new Date(c.occurred_at).toLocaleTimeString()}
                </td>
                <td>
                  <span className="badge med">{c.kind}</span>
                </td>
                <td>
                  {c.summary}
                  <div className="mono" style={{ color: 'var(--text-mute)', marginTop: 4 }}>
                    {c.entity_id}
                  </div>
                </td>
                <td
                  className="mono"
                  style={{ color: c.correlation > 0.7 ? 'var(--color-1)' : 'var(--text-dim)' }}
                >
                  {pct(c.correlation)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LoadState>
  );
}
