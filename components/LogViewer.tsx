import React, { useEffect, useMemo, useRef, useState } from 'react';

type LogEntry = {
  ts: string;
  level: string;
  event: string;
  [k: string]: any;
};

type Props = { serverBase: string };

const LogViewer: React.FC<Props> = ({ serverBase }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pretty, setPretty] = useState(true);
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'error' | 'warn' | 'debug'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [search, setSearch] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const appendLog = (entry: LogEntry) => {
    setLogs((prev) => [...prev, entry].slice(-1000));
  };

  // Initial load and SSE connection
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${serverBase}/__logs?format=json&limit=200`);
        if (!cancelled && res.ok) {
          const arr = (await res.json()) as LogEntry[];
          setLogs(Array.isArray(arr) ? arr : []);
        }
      } catch {}
    })();

    if (eventSourceRef.current) {
      try { eventSourceRef.current.close(); } catch {}
    }
    const es = new EventSource(`${serverBase}/__logs/stream?replay=100`);
    eventSourceRef.current = es;
    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);
    es.onmessage = (ev) => {
      if (paused) return;
      try {
        const entry = JSON.parse(ev.data) as LogEntry;
        appendLog(entry);
      } catch {}
    };

    return () => {
      cancelled = true;
      es.close();
      eventSourceRef.current = null;
    };
  }, [paused, serverBase]);

  // Auto-scroll
  useEffect(() => {
    if (!autoScroll) return;
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs, autoScroll]);

  const clear = () => setLogs([]);

  const filteredLogs = useMemo(() => {
    const byLevel = logs.filter((l) => levelFilter === 'all' || l.level === levelFilter);
    const q = search.trim().toLowerCase();
    if (!q) return byLevel;
    return byLevel.filter((l) => JSON.stringify(l).toLowerCase().includes(q));
  }, [logs, levelFilter, search]);

  const formatLine = (l: LogEntry) => (pretty ? JSON.stringify(l, null, 2) : JSON.stringify(l));

  const levelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warn':
      case 'warning':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-300';
      case 'debug':
        return 'text-gray-300';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg flex flex-col h-full">
      <div className="p-4 border-b border-gray-700 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h2 className="text-xl font-bold">Server Logs</h2>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${connected ? 'bg-green-700 text-green-200' : 'bg-red-700 text-red-200'}`}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
          <button
            onClick={() => setPaused((p) => !p)}
            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-md text-sm"
          >
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button onClick={clear} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-md text-sm">
            Clear
          </button>
          <button
            onClick={async () => {
              try {
                const res = await fetch(`${serverBase}/__logs?format=ndjson&limit=1000`);
                const text = await res.text();
                const blob = new Blob([text], { type: 'application/x-ndjson' });
                const a = document.createElement('a');
                const ts = new Date().toISOString().replace(/[:.]/g, '-');
                a.href = URL.createObjectURL(blob);
                a.download = `server-logs-${ts}.ndjson`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(a.href);
              } catch {}
            }}
            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-md text-sm"
          >
            Download NDJSON
          </button>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={pretty} onChange={(e) => setPretty(e.target.checked)} /> Pretty print
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> Auto-scroll
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search logs..."
            className="bg-gray-900 border border-gray-600 rounded-md px-2 py-1 text-sm w-48"
          />
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value as any)}
            className="bg-gray-900 border border-gray-600 rounded-md px-2 py-1 text-sm"
          >
            <option value="all">All</option>
            <option value="error">Error</option>
            <option value="warn">Warn</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
          </select>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-auto p-3 bg-gray-900">
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-sm">No logs yet. Interact with the server to see activity.</div>
        ) : (
          <ul className="space-y-2">
            {filteredLogs.map((entry, idx) => (
              <li key={idx} className="bg-gray-800/60 border border-gray-700 rounded p-2">
                <div className="text-xs text-gray-400 flex items-center justify-between">
                  <span className="font-mono">{entry.ts}</span>
                  <span className={`font-semibold ${levelColor(entry.level)}`}>{entry.level}</span>
                </div>
                <div className="mt-1">
                  <pre className="whitespace-pre-wrap break-words text-xs text-gray-200">
                    {formatLine(entry)}
                  </pre>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default LogViewer;
