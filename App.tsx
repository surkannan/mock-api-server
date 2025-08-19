import React, { useState } from 'react';
import { Mock } from './types';
import MockList from './components/MockList';
import MockFormModal from './components/MockFormModal';

const App: React.FC = () => {
  const [mocks, setMocks] = useState<Mock[]>([]);
  const [editingMock, setEditingMock] = useState<Mock | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const updateMocks = (newMocks: Mock[]) => {
      const sortedMocks = newMocks.sort((a, b) => parseInt(b.id) - parseInt(a.id));
      setMocks(sortedMocks);
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

  return (
    <div className="min-h-screen w-screen p-4 bg-gray-900 text-gray-100 flex flex-col items-center">
      <header className="mb-6 text-center w-full max-w-4xl">
        <h1 className="text-3xl font-bold">Mock Configuration Editor</h1>
        <div className="text-left bg-gray-800 p-4 rounded-lg mt-4 border border-blue-500/30">
            <h2 className="font-semibold text-lg text-blue-300 mb-2">How to Use</h2>
            <ol className="list-decimal list-inside text-gray-300 space-y-2 text-sm">
                <li>Use this UI to create and manage your mock API definitions.</li>
                <li>Click the <strong className="font-semibold text-gray-100">Export</strong> button to download a <code className="bg-gray-700 px-1 rounded">mocks-config.json</code> file.</li>
                <li>Place the downloaded file in the same directory as the <code className="bg-gray-700 px-1 rounded">server.js</code> file.</li>
                <li>From your terminal, run the mock server: <code className="bg-gray-900 border border-gray-600 text-green-400 px-2 py-1 rounded-md block mt-1">node server.js</code></li>
                <li>Point your applications to <code className="bg-gray-700 px-1 rounded">http://localhost:4000</code>.</li>
            </ol>
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