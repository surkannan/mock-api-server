import React, { useEffect, useState } from 'react';
import { Mock } from './types';
import MockList from './components/MockList';
import MockFormModal from './components/MockFormModal';
import LogViewer from './components/LogViewer';

const App: React.FC = () => {
  const [mocks, setMocks] = useState<Mock[]>([]);
  const [editingMock, setEditingMock] = useState<Mock | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serverHealth, setServerHealth] = useState<null | { ok: boolean; port: number; configPath: string; hasConfigFile: boolean; mocksCount: number }>(null);
  const [autoSync, setAutoSync] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncedJson, setLastSyncedJson] = useState<string | null>(null);
  const [serverBase, setServerBase] = useState<string>(() => {
    try {
      return localStorage.getItem('serverBase') || 'http://localhost:4000';
    } catch {
      return 'http://localhost:4000';
    }
  });
  const [activeTab, setActiveTab] = useState<'mocks' | 'logs'>('mocks');

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
      const sortedMocks = newMocks.sort((a, b) => parseInt(b.id) - parseInt(a.id));
      setMocks(sortedMocks);
      if (autoSync && serverHealth?.ok) {
        // fire-and-forget sync without persistence using latest payload
        syncToServer(false, sortedMocks).catch(() => {});
      }
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
      const sorted = (Array.isArray(serverMocks) ? serverMocks : []).slice().sort((a, b) => parseInt(b.id) - parseInt(a.id));
      updateMocks(sorted);
      setLastSyncedJson(JSON.stringify(sorted));
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
      setLastSyncedJson(JSON.stringify(payload ?? mocks));
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

  useEffect(() => {
    try { localStorage.setItem('serverBase', serverBase); } catch {}
  }, [serverBase]);

  useEffect(() => {
    // Attempt to refresh health when server base changes
    fetchHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverBase]);

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
                <li>Manual: Run the server: <code className="bg-gray-900 border border-gray-600 text-green-400 px-2 py-1 rounded-md block mt-1">node server.cjs</code> (config file optional)</li>
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
              {/* in-sync computation */}
              {/* disabled when in-sync, syncing, or empty */}
              <button onClick={() => syncToServer(false)} disabled={!serverHealth || syncing || mocks.length===0 || (serverHealth && lastSyncedJson === JSON.stringify(mocks))} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-md text-sm disabled:bg-gray-700 disabled:text-gray-500">{syncing ? 'Syncing...' : 'Sync to Server'}</button>
              <button onClick={() => syncToServer(true)} disabled={!serverHealth || syncing || mocks.length===0 || (serverHealth && lastSyncedJson === JSON.stringify(mocks))} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-md text-sm disabled:bg-gray-700 disabled:text-gray-500">{syncing ? 'Syncing...' : 'Sync & Persist'}</button>
              <button onClick={reloadServerFromFile} disabled={!serverHealth} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-md text-sm disabled:bg-gray-700 disabled:text-gray-500">Reload from File</button>
              <label className="flex items-center gap-2 text-sm ml-2">
                <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
                Auto-sync
              </label>
              {/* Sync status text */}
              {serverHealth && (
                <span className="text-xs text-gray-400 ml-2">
                  {lastSyncedJson === JSON.stringify(mocks) ? 'In sync with server' : 'Unsynced changes'}
                </span>
              )}
            </div>
          </div>
        </div>

      </header>
      <main className={`w-full max-w-4xl flex-grow` }>
        <MockList
          mocks={mocks}
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