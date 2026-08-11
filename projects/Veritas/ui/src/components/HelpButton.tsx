import { useEffect, useState, type ReactNode } from 'react';
import { HELP, type HelpTopic } from '../help/content';

export function HelpButton({ topic }: { topic: keyof typeof HELP }) {
  const [open, setOpen] = useState(false);
  const data: HelpTopic = HELP[topic];

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="btn-help"
        aria-label="Help"
        title="Help"
        onClick={() => setOpen(true)}
      >
        ?
      </button>

      {open && (
        <div
          className="help-overlay"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            className="help-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="help-panel-bar" />
            <div className="help-panel-head">
              <div>
                <p className="help-kicker">Help</p>
                <h2 id="help-title">{data.title}</h2>
              </div>
              <button type="button" className="help-close" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
            </div>
            <div className="help-body">
              <p className="help-lead">{data.lead}</p>
              {data.blocks.map((b) => (
                <div className="help-block" key={b.heading}>
                  <h4>{b.heading}</h4>
                  {b.body && <p>{b.body}</p>}
                  {b.bullets && (
                    <ul>
                      {b.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
              <p className="help-foot">Esc to close · Rose Petal console</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function PageHead({
  title,
  topic,
  children,
}: {
  title: string;
  topic: keyof typeof HELP;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <h1>{title}</h1>
      <div className="page-head-actions">
        {children}
        <HelpButton topic={topic} />
      </div>
    </div>
  );
}
