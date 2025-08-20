import React, { useRef } from 'react';
import { Mock } from '../types';
import PlusIcon from './icons/PlusIcon';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';
import UploadIcon from './icons/UploadIcon';
import DownloadIcon from './icons/DownloadIcon';

type DisplayRow = { kind: 'present'; mock: Mock } | { kind: 'removed'; mock: Mock };

const getStatusColor = (status?: number) => {
  if (!status && status !== 0) return 'text-gray-400';
  if (status >= 200 && status < 300) return 'text-green-400';
  if (status >= 300 && status < 400) return 'text-yellow-300';
  if (status >= 400 && status < 500) return 'text-orange-400';
  if (status >= 500) return 'text-red-400';
  return 'text-gray-400';
};

interface MockListProps {
  displayRows?: DisplayRow[];
  mocks?: Mock[]; // backward compat
  unsyncedIds?: Set<string>;
  onRestoreRemoved?: (mock: Mock) => void;
  onAdd: () => void;
  onEdit: (mock: Mock) => void;
  onDelete: (id: string) => void;
  onImport: (mocks: Mock[]) => void;
  onExport: () => void;
}

const getMethodColor = (method?: string) => {
  switch (method) {
    case 'GET': return 'text-green-400';
    case 'POST': return 'text-blue-400';
    case 'PUT': return 'text-yellow-400';
    case 'PATCH': return 'text-orange-400';
    case 'DELETE': return 'text-red-400';
    default: return 'text-gray-400';
  }
};

const MockList: React.FC<MockListProps> = ({ displayRows, mocks, unsyncedIds, onRestoreRemoved, onAdd, onEdit, onDelete, onImport, onExport }) => {
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

  const rows: DisplayRow[] = (displayRows ?? (mocks || []).map(m => ({ kind: 'present' as const, mock: m })));
  const presentCount = rows.filter(r => r.kind === 'present').length;

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
            <button onClick={onExport} disabled={presentCount === 0} className="flex-1 flex items-center justify-center px-3 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-sm font-medium disabled:bg-gray-700 disabled:cursor-not-allowed disabled:text-gray-500">
              <DownloadIcon className="w-5 h-5 mr-2" />
              Export
            </button>
        </div>
      </div>
      <div className="flex-grow overflow-y-auto p-2 space-y-3">
        {(presentCount === 0) ? (
          <div className="text-center text-gray-500 p-8">
            <p>No mocks configured yet.</p>
            <p>Click "New" to create one, or "Import" to load a file.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {rows.map(row => {
              const mock = row.mock;
              const isRemoved = row.kind === 'removed';
              const isUnsynced = isRemoved || (!!unsyncedIds && unsyncedIds.has(mock.id));
              const path = mock.matcher?.path || '';
              const method = mock.matcher?.method || '';
              const displayName = (mock.name && mock.name.trim().length > 0) ? mock.name : path || '(unnamed)';
              return (
                <li key={`${row.kind}-${mock.id}`} className={`rounded-md p-3 group ${isRemoved ? 'bg-gray-700/40 border border-amber-500/30' : isUnsynced ? 'bg-gray-700/60 border border-amber-500/40' : 'bg-gray-700/50'}`}>
                  <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                    <div className="min-w-0 overflow-hidden">
                      <p className={`font-semibold truncate ${isRemoved ? 'text-amber-300' : isUnsynced ? 'text-amber-300' : ''}`}>{displayName}</p>
                      <div className="flex items-center text-sm text-gray-400 font-mono mt-1">
                        <span className={`font-bold w-16 ${getMethodColor(method)}`}>{method || '-'}</span>
                        <span className="truncate">{path || '-'}</span>
                      </div>
                      {/* flags moved to far-right column */}
                    </div>
                    <div className="flex items-center justify-end">
                      {isRemoved ? (
                        <span className="text-[10px] uppercase tracking-wide text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5">unsynced</span>
                      ) : (
                        isUnsynced && <span className="text-[10px] uppercase tracking-wide text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-0.5">unsynced</span>
                      )}
                    </div>
                    {isRemoved ? (
                      <div className="flex items-center space-x-2 justify-end">
                        <div className="flex items-center gap-2 text-[11px] mr-2">
                          <span className={`font-mono ${getStatusColor((mock as any).response?.status)}`}>→ {(mock as any).response?.status ?? '-'}</span>
                          {((mock as any).response?.headers?.length ?? 0) > 0 && (
                            <span className="uppercase tracking-wide text-gray-300 bg-gray-700/60 border border-gray-600 rounded px-1.5 py-0.5">headers</span>
                          )}
                          {(((mock as any).response?.body ?? '').toString().trim().length) > 0 && (
                            <span className="uppercase tracking-wide text-gray-300 bg-gray-700/60 border border-gray-600 rounded px-1.5 py-0.5">body</span>
                          )}
                          {(((mock as any).response?.delay ?? 0) > 0) && (
                            <span className="uppercase tracking-wide text-gray-300 bg-gray-700/60 border border-gray-600 rounded px-1.5 py-0.5">delay</span>
                          )}
                        </div>
                        {onRestoreRemoved && (
                          <button onClick={() => onRestoreRemoved(mock)} className="px-2 py-1 text-xs bg-amber-600 hover:bg-amber-500 rounded">Restore</button>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2 justify-end">
                        <div className="flex items-center gap-2 text-[11px] mr-2">
                          <span className={`font-mono ${getStatusColor((mock as any).response?.status)}`}>→ {(mock as any).response?.status ?? '-'}</span>
                          {((mock as any).response?.headers?.length ?? 0) > 0 && (
                            <span className="uppercase tracking-wide text-gray-300 bg-gray-700/60 border border-gray-600 rounded px-1.5 py-0.5">headers</span>
                          )}
                          {(((mock as any).response?.body ?? '').toString().trim().length) > 0 && (
                            <span className="uppercase tracking-wide text-gray-300 bg-gray-700/60 border border-gray-600 rounded px-1.5 py-0.5">body</span>
                          )}
                          {(((mock as any).response?.delay ?? 0) > 0) && (
                            <span className="uppercase tracking-wide text-gray-300 bg-gray-700/60 border border-gray-600 rounded px-1.5 py-0.5">delay</span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => onEdit(mock)} className="p-1 text-gray-400 hover:text-white">
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button onClick={() => onDelete(mock.id)} className="p-1 text-gray-400 hover:text-red-400">
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    )}
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
