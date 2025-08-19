import React, { useEffect, useState } from 'react';
import { Mock } from './types';
import MockList from './components/MockList';
import MockFormModal from './components/MockFormModal';

const App: React.FC = () => {
  const [mocks, setMocks] = useState<Mock[]>([]);
  const [editingMock, setEditingMock] = useState<Mock | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serverHealth, setServerHealth] = useState<null | { ok: boolean; port: number; configPath: string; hasConfigFile: boolean; mocksCount: number }>(null);
  const [autoSync, setAutoSync] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const SERVER_BASE = 'http://localhost:4000';

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
      const res = await fetch(`${SERVER_BASE}/__health`);
      if (!res.ok) throw new Error('Health check failed');
      const data = await res.json();
      setServerHealth(data);
    } catch (e) {
      setServerHealth(null);
    }
  };

  const loadFromServer = async () => {
    try {
      const res = await fetch(`${SERVER_BASE}/__mocks`);
      if (!res.ok) throw new Error('Failed to load mocks from server');
      const serverMocks: Mock[] = await res.json();
      updateMocks(Array.isArray(serverMocks) ? serverMocks : []);
    } catch (e) {
      alert('Could not load from server. Is it running on port 4000?');
    }
  };

  const syncToServer = async (persist: boolean, payload?: Mock[]) => {
    setSyncing(true);
    try {
      const res = await fetch(`${SERVER_BASE}/__mocks?persist=${persist ? 'true' : 'false' }`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload ?? mocks),
      });
      if (!res.ok) throw new Error('Failed to sync mocks');
      await fetchHealth();
    } catch (e) {
      alert('Sync failed. Ensure the server is running and CORS is allowed.');
    } finally {
      setSyncing(false);
    }
  };

  const reloadServerFromFile = async () => {
    try {
      const res = await fetch(`${SERVER_BASE}/__reload`, { method: 'POST' });
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

  return (
    <div className="min-h-screen w-screen p-4 bg-gray-900 text-gray-100 flex flex-col items-center">
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
                  <>Server connected on <code className="bg-gray-700 px-1 rounded">:{serverHealth.port}</code> · {serverHealth.mocksCount} mocks{serverHealth.hasConfigFile ? ' · config file found' : ' · no config file'}</>
                ) : (
                  <>Server unreachable at <code className="bg-gray-700 px-1 rounded">:4000</code></>
                )}
              </span>
              <button onClick={fetchHealth} className="ml-3 text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded">Refresh</button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={loadFromServer} disabled={!serverHealth} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-md text-sm disabled:bg-gray-700 disabled:text-gray-500">Load from Server</button>
              <button onClick={() => syncToServer(false)} disabled={!serverHealth || syncing || mocks.length===0} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-md text-sm disabled:bg-gray-700 disabled:text-gray-500">{syncing ? 'Syncing...' : 'Sync to Server'}</button>
              <button onClick={() => syncToServer(true)} disabled={!serverHealth || syncing || mocks.length===0} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-md text-sm disabled:bg-gray-700 disabled:text-gray-500">{syncing ? 'Syncing...' : 'Sync & Persist'}</button>
              <button onClick={reloadServerFromFile} disabled={!serverHealth} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded-md text-sm disabled:bg-gray-700 disabled:text-gray-500">Reload from File</button>
              <label className="flex items-center gap-2 text-sm ml-2">
                <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} />
                Auto-sync
              </label>
            </div>
          </div>
        </div>
      </header>
      <main className="w-full max-w-4xl flex-grow">
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