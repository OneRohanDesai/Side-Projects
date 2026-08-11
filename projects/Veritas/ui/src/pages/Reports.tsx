import { useState } from 'react';
import { api, pct } from '../api';
import { LoadState } from '../components/LoadState';
import { PageHead } from '../components/HelpButton';
import { useApi } from '../hooks/useApi';

type Tab = 'daily' | 'weekly' | 'capacity' | 'cost' | 'security' | 'postmortem' | 'incident';

export function Reports() {
  const { data, loading, error } = useApi(() => api.reportSuite(), []);
  const [tab, setTab] = useState<Tab>('daily');

  const daily = data?.daily;
  const weekly = data?.weekly;

  const body = (() => {
    if (!data) return '';
    switch (tab) {
      case 'daily':
        return `DAILY ENGINEERING INTELLIGENCE
${daily?.date}

Health  ${'█'.repeat(Math.round((daily?.overall_health ?? 0) * 20))}${'░'.repeat(20 - Math.round((daily?.overall_health ?? 0) * 20))} ${pct(daily?.overall_health ?? 0)}

Changes
  deployments       ${daily?.changes.deployments ?? 0}
  configuration     ${daily?.changes.configuration ?? 0}
  infrastructure    ${daily?.changes.infrastructure ?? 0}

Anomalies           ${daily?.anomalies_detected}
High significance   ${daily?.high_significance}
Potential incidents ${daily?.potential_incidents}

Performance   ${daily?.performance_degradation}
Capacity      ${daily?.capacity_concern}
Security      ${daily?.security_concern}
Cost save     $${daily?.cost_opportunity_usd.toLocaleString()}/mo

Actions
${(daily?.recommended_actions ?? []).map((a, i) => `  ${i + 1}. ${a}`).join('\n')}

Source: analytical engine`;
      case 'weekly':
        return `WEEKLY RELIABILITY
${weekly?.window}

Deployments     ${weekly?.deployments}
Incidents       ${weekly?.incidents}
MTTR minutes    ${weekly?.mttr_minutes}
Error budget    ${pct(weekly?.error_budget_burn ?? 0)} burn

Top regressed
${(weekly?.top_regressed ?? []).map((t) => `  · ${t}`).join('\n')}

${weekly?.narrative}

Source: analytical engine`;
      case 'capacity':
        return data.capacity;
      case 'cost':
        return data.cost;
      case 'security':
        return data.security;
      case 'postmortem':
        return data.postmortem_draft;
      case 'incident':
        return data.incident;
      default:
        return '';
    }
  })();

  const tabs: { id: Tab; label: string }[] = [
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'capacity', label: 'Capacity' },
    { id: 'cost', label: 'Cost' },
    { id: 'security', label: 'Security' },
    { id: 'postmortem', label: 'Postmortem' },
    { id: 'incident', label: 'Incident' },
  ];

  return (
    <LoadState loading={loading} error={error}>
      <PageHead title="Reports" topic="reports" />

      <div className="grid grid-4">
        <div className="card">
          <h3>Health</h3>
          <div className="stat accent">{pct(daily?.overall_health ?? 0)}</div>
        </div>
        <div className="card">
          <h3>MTTR</h3>
          <div className="stat soft">{weekly?.mttr_minutes ?? '·'}m</div>
        </div>
        <div className="card">
          <h3>Budget burn</h3>
          <div className="stat sand">{pct(weekly?.error_budget_burn ?? 0)}</div>
        </div>
        <div className="card">
          <h3>Cost save</h3>
          <div className="stat sage">${daily?.cost_opportunity_usd.toLocaleString()}</div>
        </div>
      </div>

      <div className="btn-row section-gap">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`btn ${tab === t.id ? 'btn-primary' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="section-gap report-block">{body}</div>
    </LoadState>
  );
}
