import { NavLink, Route, Routes } from 'react-router-dom';
import { CommandDeck } from './pages/CommandDeck';
import { WhatChanged } from './pages/WhatChanged';
import { WhyEngine } from './pages/WhyEngine';
import { Forecast } from './pages/Forecast';
import { Graph } from './pages/Graph';
import { Entities } from './pages/Entities';
import { Archaeology } from './pages/Archaeology';
import { Reports } from './pages/Reports';
import { Actions } from './pages/Actions';
import { Cost } from './pages/Cost';
import { Telemetry } from './pages/Telemetry';
import { Analytics } from './pages/Analytics';
import { Intelligence } from './pages/Intelligence';
import { Ai } from './pages/Ai';
import { Enterprise } from './pages/Enterprise';
import { Plugins } from './pages/Plugins';
import { Settings } from './pages/Settings';

const intel = [
  { to: '/', label: 'Deck', icon: '⌘', end: true },
  { to: '/intelligence', label: 'Intel', icon: '◈' },
  { to: '/what-changed', label: 'Changed', icon: 'Δ' },
  { to: '/why', label: 'Why', icon: '?' },
  { to: '/forecast', label: 'Forecast', icon: '↗' },
  { to: '/graph', label: 'Graph', icon: '◎' },
  { to: '/entities', label: 'Entities', icon: '◉' },
  { to: '/archaeology', label: 'Archaeology', icon: '⛏' },
];

const ops = [
  { to: '/telemetry', label: 'Telemetry', icon: '⌀' },
  { to: '/analytics', label: 'Analytics', icon: 'Σ' },
  { to: '/ai', label: 'AI', icon: '✦' },
  { to: '/reports', label: 'Reports', icon: '▣' },
  { to: '/actions', label: 'Actions', icon: '⚡' },
  { to: '/cost', label: 'Cost', icon: '$' },
  { to: '/enterprise', label: 'Enterprise', icon: '▣' },
  { to: '/plugins', label: 'Plugins', icon: '⬡' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
];

export default function App() {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">VERITAS</div>
          <div className="brand-latin">
            Vis Explorationis Rerum
            <br />
            Intelligentia Technica Analytica Systematica
          </div>
        </div>

        <div className="nav-section">Intelligence</div>
        {intel.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <div className="nav-section">Operations</div>
        {ops.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <div className="sidebar-foot">
          Rose Petal · Local first
          <br />
          Questions over dashboards
        </div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<CommandDeck />} />
          <Route path="/intelligence" element={<Intelligence />} />
          <Route path="/what-changed" element={<WhatChanged />} />
          <Route path="/why" element={<WhyEngine />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/graph" element={<Graph />} />
          <Route path="/entities" element={<Entities />} />
          <Route path="/archaeology" element={<Archaeology />} />
          <Route path="/telemetry" element={<Telemetry />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/ai" element={<Ai />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/actions" element={<Actions />} />
          <Route path="/cost" element={<Cost />} />
          <Route path="/enterprise" element={<Enterprise />} />
          <Route path="/plugins" element={<Plugins />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
