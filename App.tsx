import React, { useEffect, useMemo, useState } from 'react';
import { Mock } from './types';
import MockList from './components/MockList';
import MockFormModal from './components/MockFormModal';
import LogViewer from './components/LogViewer';

type DisplayRow = { kind: 'present'; mock: Mock } | { kind: 'removed'; mock: Mock };

const App: React.FC = () => {
  const [mocks, setMocks] = useState<Mock[]>([]);
  const [editingMock, setEditingMock] = useState<Mock | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serverHealth, setServerHealth] = useState<null | { ok: boolean; port: number; configPath: string; hasConfigFile: boolean; mocksCount: number }>(null);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedJson, setLastSyncedJson] = useState<string | null>(null);
  const [lastSyncedOrder, setLastSyncedOrder] = useState<string[] | null>(null);
  const [serverBase, setServerBase] = useState<string>(() => {
    try {
      return localStorage.getItem('serverBase') || 'http://localhost:4000';
    } catch {
      return 'http://localhost:4000';
    }
  });
  const [activeTab, setActiveTab] = useState<'mocks' | 'logs'>('mocks');
  const [bootstrapped, setBootstrapped] = useState<boolean>(() => {
    try { return localStorage.getItem('bootstrappedFromServer') === 'true'; } catch { return false; }
  });
  const [syncMenuOpen, setSyncMenuOpen] = useState(false);

  // Deterministic comparator for mocks: numeric id desc if numeric, else string id desc; tie-breaker by path then method
  const toNumber = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  // Snapshot order (from lastSyncedJson) to keep display positions stable while editing
  const snapshotOrder = useMemo(() => {
    try {
      const ids: string[] | null = lastSyncedOrder ?? (() => {
        if (!lastSyncedJson) return null;
        const arr = JSON.parse(lastSyncedJson);
        if (!Array.isArray(arr)) return null;
        return arr.map((m: any) => String(m?.id)).filter(Boolean);
      })();
      if (!ids) return new Map<string, number>();
      const map = new Map<string, number>();
      ids.forEach((id, idx) => map.set(String(id), idx));
      return map;
    } catch {
      return new Map<string, number>();
    }
  }, [lastSyncedJson, lastSyncedOrder]);

  // Display comparator: honor snapshot order; new items (not in snapshot) come first by id desc
  const compareDisplay = (a: Mock, b: Mock) => {
    const ai = snapshotOrder.get(a.id);
    const bi = snapshotOrder.get(b.id);
    const aIn = ai !== undefined;
    const bIn = bi !== undefined;
    if (aIn && bIn) return (ai as number) - (bi as number);
    if (aIn && !bIn) return 1; // existing after new
    if (!aIn && bIn) return -1; // new before existing
    // both new: fall back to id desc (numeric if possible)
    return compareMocks(a, b);
  };
  const compareMocks = (a: Mock, b: Mock) => {
    const an = toNumber(a.id);
    const bn = toNumber(b.id);
    if (an !== null && bn !== null) return bn - an;
    if (a.id !== b.id) return b.id.localeCompare(a.id);
    const ap = a.matcher?.path || '';
    const bp = b.matcher?.path || '';
    if (ap !== bp) return ap.localeCompare(bp);
    const am = a.matcher?.method || '';
    const bm = b.matcher?.method || '';
    return am.localeCompare(bm);
  };

  // Stable stringify helpers to avoid false diffs due to order/key differences
  const sortKV = <T extends { key: string; value: string }>(arr: T[]): T[] =>
    arr.slice().sort((a, b) => (a.key || '').localeCompare(b.key || '') || (a.value || '').localeCompare(b.value || ''));

  const normalizeMock = (m: Mock): Mock => ({
    ...m,
    matcher: {
      ...m.matcher,
      headers: sortKV((m.matcher?.headers || []).filter(h => h && h.key !== undefined)),
      queryParams: sortKV((m.matcher?.queryParams || []).filter(q => q && q.key !== undefined)),
    },
    response: {
      ...m.response,
      headers: sortKV((m.response?.headers || []).filter(h => h && h.key !== undefined)),
    },
  });

  const normalizeValue = (v: any): any => {
    if (Array.isArray(v)) return v.map(normalizeValue);
    if (v && typeof v === 'object') {
      const keys = Object.keys(v).sort();
      const out: any = {};
      for (const k of keys) out[k] = normalizeValue(v[k]);
      return out;
    }
    return v;
  };
  const stableStringifyMocks = (arr: Mock[]) => {
    const byIdDesc = arr.slice().sort(compareMocks);
    const pre = byIdDesc.map(normalizeMock);
    const normalized = pre.map((m) => normalizeValue(m));
    return JSON.stringify(normalized);
  };

  // Tabs switcher (button group only)
  const Tabs = (
    <div className="inline-flex rounded-md overflow-hidden border border-gray-700">
      <button
        onClick={() => setActiveTab('mocks')}
        className={`px-4 py-2 text-sm ${activeTab === 'mocks' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
      >
        Mocks
      </button>
      <button
        onClick={() => setActiveTab('logs')}
        className={`px-4 py-2 text-sm ${activeTab === 'logs' ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
      >
        Logs
      </button>
    </div>
  );

  const updateMocks = (newMocks: Mock[]) => {
      const sortedMocks = newMocks.sort(compareDisplay);
      setMocks(sortedMocks);
      // persist UI state locally to survive reloads
      try { localStorage.setItem('uiMocks', JSON.stringify(sortedMocks)); } catch {}
  };
  
  const handleAddMock = () => {
    setEditingMock(null);
    setIsModalOpen(true);
  };

  const handleEditMock = (mock: Mock) => {
    setEditingMock(mock);
    setIsModalOpen(true);
  };

  const handleDeleteMock = (id: string) => {
    updateMocks(mocks.filter(m => m.id !== id));
  };

  const handleSaveMock = (mock: Mock) => {
    const index = mocks.findIndex(m => m.id === mock.id);
    let newMocks;
    if (index > -1) {
      newMocks = [...mocks];
      newMocks[index] = mock;
    } else {
      newMocks = [mock, ...mocks];
    }
    updateMocks(newMocks);
  };

  const handleExportMocks = () => {
    if (mocks.length === 0) {
      alert("No mocks to export.");
      return;
    }
    const jsonString = JSON.stringify(mocks, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mocks-config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportMocks = (importedMocks: Mock[]) => {
    if (window.confirm('This will replace your current mock configuration. Are you sure?')) {
      updateMocks(importedMocks);
    }
  };

  // --- Server integration helpers ---
  const fetchHealth = async () => {
    try {
      const res = await fetch(`${serverBase}/__health`);
      if (!res.ok) throw new Error('Health check failed');
      const data = await res.json();
      setServerHealth(data);
    } catch (e) {
      setServerHealth(null);
    }
  };

  const loadFromServer = async () => {
    try {
      const res = await fetch(`${serverBase}/__mocks`);
      if (!res.ok) throw new Error('Failed to load mocks from server');
      const serverMocks: Mock[] = await res.json();
      const sorted = (Array.isArray(serverMocks) ? serverMocks : []).slice().sort(compareDisplay);
      updateMocks(sorted);
      const synced = stableStringifyMocks(sorted);
      setLastSyncedJson(synced);
      try { localStorage.setItem('lastSyncedJson', synced); } catch {}
      const orderIds = sorted.map(m => m.id);
      setLastSyncedOrder(orderIds);
      try { localStorage.setItem('lastSyncedOrder', JSON.stringify(orderIds)); } catch {}
    } catch (e) {
      alert('Could not load from server. Check the server URL and that it is running.');
    }
  };

  const syncToServer = async (persist: boolean, payload?: Mock[]) => {
    setSyncing(true);
    try {
      const res = await fetch(`${serverBase}/__mocks?persist=${persist ? 'true' : 'false' }`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload ?? mocks),
      });
      if (!res.ok) throw new Error('Failed to sync mocks');
      await fetchHealth();
      const finalMocks = payload ?? mocks;
      const synced = stableStringifyMocks(finalMocks);
      setLastSyncedJson(synced);
      try { localStorage.setItem('lastSyncedJson', synced); } catch {}
      const orderIds = finalMocks.slice().sort(compareDisplay).map(m => m.id);
      setLastSyncedOrder(orderIds);
      try { localStorage.setItem('lastSyncedOrder', JSON.stringify(orderIds)); } catch {}
    } catch (e) {
      alert('Sync failed. Ensure the server is running and CORS is allowed.');
    } finally {
      setSyncing(false);
    }
  };

  const reloadServerFromFile = async () => {
    try {
      const res = await fetch(`${serverBase}/__reload`, { method: 'POST' });
      if (!res.ok) throw new Error('Reload failed');
      await fetchHealth();
    } catch (e) {
      alert('Reload failed. Is the server running?');
    }
  };

  useEffect(() => {
    fetchHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore local UI mocks and sync status on load
  useEffect(() => {
    try {
      const raw = localStorage.getItem('uiMocks');
      if (raw) {
        const arr = JSON.parse(raw) as Mock[];
        if (Array.isArray(arr)) {
          const sorted = arr.slice().sort(compareDisplay);
          setMocks(sorted);
          // If no snapshot exists at all, seed snapshot order from current UI order to keep positions stable
          const hasSnapshot = Boolean(localStorage.getItem('lastSyncedJson') || localStorage.getItem('lastSyncedOrder'));
          if (!hasSnapshot && sorted.length > 0) {
            const orderIds = sorted.map(m => m.id);
            setLastSyncedOrder(orderIds);
            try { localStorage.setItem('lastSyncedOrder', JSON.stringify(orderIds)); } catch {}
          }
        }
      }
      const last = localStorage.getItem('lastSyncedJson');
      if (last) setLastSyncedJson(last);
      const orderRaw = localStorage.getItem('lastSyncedOrder');
      if (orderRaw) {
        try { setLastSyncedOrder(JSON.parse(orderRaw)); } catch {}
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem('serverBase', serverBase); } catch {}
  }, [serverBase]);

  useEffect(() => {
    // Attempt to refresh health when server base changes
    fetchHealth();
    // Reset bootstrap flag when target server changes (so we can bootstrap for a different server)
    try { localStorage.removeItem('bootstrappedFromServer'); } catch {}
    setBootstrapped(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverBase]);

  // Auto-bootstrap mocks from server on first load (once per serverBase) only if there are no locally saved mocks
  useEffect(() => {
    const serverHasMocks = !!(serverHealth && typeof serverHealth.mocksCount === 'number' && serverHealth.mocksCount > 0);
    const hasLocalMocks = (() => { try { return !!localStorage.getItem('uiMocks'); } catch { return false; } })();
    if (!bootstrapped && serverHealth?.ok && serverHasMocks && mocks.length === 0 && !hasLocalMocks) {
      loadFromServer()
        .then(() => {
          try { localStorage.setItem('bootstrappedFromServer', 'true'); } catch {}
          setBootstrapped(true);
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverHealth, bootstrapped, mocks.length]);

  // Derived sync state for buttons
  const inSync = Boolean(serverHealth && lastSyncedJson === stableStringifyMocks(mocks));
  const canSync = Boolean(serverHealth && !syncing && mocks.length > 0 && !inSync);

  // Derive unsynced mock ids by deep comparing normalized mocks vs lastSyncedJson snapshot
  const unsyncedIds: Set<string> = (() => {
    try {
      if (!lastSyncedJson) return new Set<string>();
      const parsed = JSON.parse(lastSyncedJson) as Mock[] | any[];
      if (!Array.isArray(parsed)) return new Set<string>();
      // parsed is normalized and sorted when we stored it
      const byId = new Map<string, any>();
      for (const m of parsed as any[]) {
        if (m && m.id) byId.set(String(m.id), m);
      }
      const set = new Set<string>();
      for (const cur of mocks) {
        const curNorm = normalizeValue(normalizeMock(cur));
        const prev = byId.get(String(cur.id));
        if (!prev || JSON.stringify(curNorm) !== JSON.stringify(prev)) set.add(cur.id);
      }
      return set;
    } catch {
      return new Set<string>();
    }
  })();

  // Derive mocks that existed at last sync but are now missing locally (deleted but not synced)
  const removedUnsyncedMocks: Mock[] = (() => {
    try {
      if (!lastSyncedJson) return [];
      const parsed = JSON.parse(lastSyncedJson) as any[];
      if (!Array.isArray(parsed)) return [];
      const currentIds = new Set(mocks.map(m => String(m.id)));
      const removed = parsed.filter((m) => m && m.id && !currentIds.has(String(m.id)));
      // Best-effort cast to Mock; fields were stored from server snapshot
      return removed as unknown as Mock[];
    } catch {
      return [];
    }
  })();

  const handleRestoreRemovedMock = (mock: Mock) => {
    // Re-add the mock locally
    updateMocks([mock, ...mocks]);
  };

  // Build a unified display list: new items first (not in snapshot), then snapshot-ordered items with inline placeholders for deleted
  const displayRows: DisplayRow[] = useMemo(() => {
    try {
      const byId = new Map<string, Mock>();
      mocks.forEach(m => byId.set(m.id, m));
      // Preferred order of existing items
      const orderIds: string[] = lastSyncedOrder ?? (() => {
        try {
          if (!lastSyncedJson) return [] as string[];
          const arr = JSON.parse(lastSyncedJson);
          if (!Array.isArray(arr)) return [] as string[];
          return arr.map((m: any) => String(m?.id)).filter(Boolean);
        } catch { return [] as string[]; }
      })();
      const orderSet = new Set(orderIds);
      const newItems = mocks.filter(m => !orderSet.has(m.id)).sort(compareMocks).map<DisplayRow>((m) => ({ kind: 'present', mock: m }));

      // Build map of last-synced mocks for placeholders
      let lastSyncedById = new Map<string, any>();
      try {
        if (lastSyncedJson) {
          const arr = JSON.parse(lastSyncedJson);
          if (Array.isArray(arr)) {
            arr.forEach((m: any) => { if (m && m.id != null) lastSyncedById.set(String(m.id), m); });
          }
        }
      } catch {}

      const existingOrdered: DisplayRow[] = orderIds.map((id) => {
        const present = byId.get(id);
        if (present) return { kind: 'present', mock: present };
        const prev = lastSyncedById.get(id);
        if (prev) return { kind: 'removed', mock: prev as Mock };
        return null as unknown as DisplayRow;
      }).filter(Boolean) as DisplayRow[];

      // Render snapshot-ordered rows first (present/removed inline), then append new items
      return [...existingOrdered, ...newItems];
    } catch {
      return mocks.map<DisplayRow>((m) => ({ kind: 'present', mock: m }));
    }
  }, [mocks, lastSyncedJson, lastSyncedOrder]);

  // Full-screen Logs view (no margins) when Logs tab is active
  if (activeTab === 'logs') {
    return (
      <div className="fixed inset-0 bg-gray-900 text-gray-100 flex flex-col">
        <div className="p-2 border-b border-gray-800 flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${serverHealth ? 'bg-green-400' : 'bg-red-400'}`}></span>
          <span className="text-sm">Logs · {serverHealth ? `${serverHealth.mocksCount} mocks` : 'disconnected'}</span>
          <input
            type="text"
            value={serverBase}
            onChange={(e) => setServerBase(e.target.value)}
            className="ml-2 text-xs bg-gray-900 border border-gray-600 rounded px-2 py-1 font-mono w-64"
            placeholder="http://localhost:4000"
          />
          <button onClick={fetchHealth} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded">Connect</button>
          <div className="ml-auto" />
          {Tabs}
        </div>
        <div className="flex-1 min-h-0">
          <LogViewer serverBase={serverBase} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-screen p-4 bg-gray-900 text-gray-100 flex flex-col items-center">
      <div className="w-full max-w-4xl mx-auto flex justify-end">
        {Tabs}
      </div>
      <header className="mb-6 text-center w-full max-w-4xl">
        <h1 className="text-3xl font-bold">Mock Configuration Editor</h1>
        <div className="text-left bg-gray-800 p-4 rounded-lg mt-4 border border-blue-500/30">
            <h2 className="font-semibold text-lg text-blue-300 mb-2">How to Use</h2>
            <ol className="list-decimal list-inside text-gray-300 space-y-2 text-sm">
                <li>Use this UI to create and manage your mock API definitions.</li>
                <li>Option A: Click <strong className="font-semibold text-gray-100">Export</strong> to download <code className="bg-gray-700 px-1 rounded">mocks-config.json</code>.</li>
                <li>Option B: Use <strong>Sync to Server</strong> below to push mocks directly without exporting.</li>
                <li>Dev: <code className="bg-gray-900 border border-gray-600 text-green-400 px-2 py-1 rounded-md block mt-1">npm run dev</code> starts both this UI and the server.</li>
                <li>Point your applications to <code className="bg-gray-700 px-1 rounded">http://localhost:4000</code>.</li>
            </ol>
        </div>

        {/* Server status and actions */}
        <div className="mt-4 text-left bg-gray-800 p-4 rounded-lg border border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${serverHealth ? 'bg-green-400' : 'bg-red-400'}`}></span>
              <span className="text-sm">
                {serverHealth ? (
                  <>Server connected: <code className="bg-gray-700 px-1 rounded">{serverBase}</code> · {serverHealth.mocksCount} mocks{serverHealth.hasConfigFile ? ' · config file found' : ' · no config file'}</>
                ) : (
                  <>Server unreachable at <code className="bg-gray-700 px-1 rounded">{serverBase}</code></>
                )}
              </span>
              <input
                type="text"
                value={serverBase}
                onChange={(e) => setServerBase(e.target.value)}
                className="ml-3 text-xs bg-gray-900 border border-gray-600 rounded px-2 py-1 font-mono w-64"
                placeholder="http://localhost:4000"
              />
              <button onClick={fetchHealth} className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded">Connect</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={loadFromServer} disabled={!serverHealth} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-md text-sm disabled:bg-gray-700 disabled:text-gray-500">Load from Server</button>
              {/* Sync split button with dropdown */}
              <div className="relative inline-flex" onBlur={() => setTimeout(() => setSyncMenuOpen(false), 100)}>
                <button
                  onClick={() => syncToServer(true)}
                  disabled={!canSync}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-l-md text-sm disabled:bg-gray-700 disabled:text-gray-500"
                  title="Sync & Persist"
                >
                  {syncing ? 'Syncing…' : 'Sync'}
                </button>
                <button
                  onClick={() => { if (canSync) setSyncMenuOpen(v => !v); }}
                  disabled={!canSync}
                  className="px-2 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-r-md text-sm border-l border-indigo-500 disabled:bg-gray-700 disabled:text-gray-500"
                  aria-haspopup="menu"
                  aria-expanded={syncMenuOpen}
                  title="More sync options"
                >
                  ▾
                </button>
                {syncMenuOpen && (
                  <div className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10">
                    <button
                      onClick={() => { setSyncMenuOpen(false); syncToServer(false); }}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-gray-700"
                    >
                      Sync (memory only)
                    </button>
                  </div>
                )}
              </div>
              <button onClick={reloadServerFromFile} disabled={!serverHealth} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-md text-sm disabled:bg-gray-700 disabled:text-gray-500">Reload from File</button>
              {/* Auto-sync removed */}
              {/* Dev-only badge and Sync status text */}
              <span
                className="text-[10px] uppercase tracking-wide text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5"
                title="For development/testing only. Single instance, local browser state, optional on-disk mocks-config.json when persisted. Not for production use."
              >
                Dev/Testing only
              </span>
              {serverHealth && (
                <span className="text-xs text-gray-400 ml-2">
                  {lastSyncedJson === stableStringifyMocks(mocks) ? 'In sync with server' : 'Unsynced changes'}
                </span>
              )}
            </div>
          </div>
        </div>

      </header>
      <main className={`w-full max-w-4xl flex-grow` }>
        <MockList
          displayRows={displayRows}
          unsyncedIds={unsyncedIds}
          onRestoreRemoved={handleRestoreRemovedMock}
          onAdd={handleAddMock}
          onEdit={handleEditMock}
          onDelete={handleDeleteMock}
          onImport={handleImportMocks}
          onExport={handleExportMocks}
        />
      </main>
      <MockFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveMock}
        initialMock={editingMock}
      />
    </div>
  );
};

export default App;
