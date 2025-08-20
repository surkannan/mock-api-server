import React, { useRef } from 'react';
import { Mock } from '../types';
import PlusIcon from './icons/PlusIcon';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';
import UploadIcon from './icons/UploadIcon';
import DownloadIcon from './icons/DownloadIcon';

interface MockListProps {
  mocks: Mock[];
  unsyncedIds?: Set<string>;
  onAdd: () => void;
  onEdit: (mock: Mock) => void;
  onDelete: (id: string) => void;
  onImport: (mocks: Mock[]) => void;
  onExport: () => void;
}

const getMethodColor = (method: string) => {
  switch (method) {
    case 'GET': return 'text-green-400';
    case 'POST': return 'text-blue-400';
    case 'PUT': return 'text-yellow-400';
    case 'PATCH': return 'text-orange-400';
    case 'DELETE': return 'text-red-400';
    default: return 'text-gray-400';
  }
};

const MockList: React.FC<MockListProps> = ({ mocks, unsyncedIds, onAdd, onEdit, onDelete, onImport, onExport }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("File is not readable");
        const importedMocks = JSON.parse(text);
        
        // Basic validation
        if (Array.isArray(importedMocks)) {
          onImport(importedMocks);
        } else {
          alert('Error: Imported file is not a valid mock array.');
        }
      } catch (error) {
        alert('Error parsing JSON file: ' + (error as Error).message);
      } finally {
        // Reset file input to allow re-uploading the same file
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg flex flex-col h-full">
      <div className="p-4 border-b border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Configured Mocks</h2>
          <button onClick={onAdd} className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-medium">
            <PlusIcon className="w-5 h-5 mr-1" />
            New
          </button>
        </div>
        <div className="flex space-x-2">
            <button onClick={handleImportClick} className="flex-1 flex items-center justify-center px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-sm font-medium">
              <UploadIcon className="w-5 h-5 mr-2" />
              Import
            </button>
            <input type="file" accept=".json" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
            <button onClick={onExport} disabled={mocks.length === 0} className="flex-1 flex items-center justify-center px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-sm font-medium disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500">
              <DownloadIcon className="w-5 h-5 mr-2" />
              Export
            </button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto p-2">
        {mocks.length === 0 ? (
          <div className="text-center text-gray-500 p-8">
            <p>No mocks configured yet.</p>
            <p>Click "New" to create one, or "Import" to load a file.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {mocks.map(mock => {
              const isUnsynced = !!unsyncedIds && unsyncedIds.has(mock.id);
              const displayName = (mock.name && mock.name.trim().length > 0) ? mock.name : mock.matcher.path;
              return (
                <li key={mock.id} className={`rounded-md p-3 group ${isUnsynced ? 'bg-gray-700/60 border border-amber-500/40' : 'bg-gray-700/50'}`}>
                  <div className="flex justify-between items-center">
                    <div className="flex-1 overflow-hidden">
                      <p className={`font-semibold truncate ${isUnsynced ? 'text-amber-300' : ''}`}>{displayName}</p>
                      <div className="flex items-center text-sm text-gray-400 font-mono mt-1">
                        <span className={`font-bold w-16 ${getMethodColor(mock.matcher.method)}`}>{mock.matcher.method}</span>
                        <span className="truncate">{mock.matcher.path}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {isUnsynced && (
                        <span className="text-[10px] uppercase tracking-wide text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5 mr-1">unsynced</span>
                      )}
                      <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(mock)} className="p-1 text-gray-400 hover:text-white">
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => onDelete(mock.id)} className="p-1 text-gray-400 hover:text-red-400">
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MockList;
