
import React from 'react';
import { Mock } from '../types';
import PlusIcon from './icons/PlusIcon';
import PencilIcon from './icons/PencilIcon';
import TrashIcon from './icons/TrashIcon';

interface MockListProps {
  mocks: Mock[];
  onAdd: () => void;
  onEdit: (mock: Mock) => void;
  onDelete: (id: string) => void;
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

const MockList: React.FC<MockListProps> = ({ mocks, onAdd, onEdit, onDelete }) => {
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg flex flex-col h-full">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-xl font-bold">Configured Mocks</h2>
        <button onClick={onAdd} className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-medium">
          <PlusIcon className="w-5 h-5 mr-1" />
          New
        </button>
      </div>
      <div className="flex-grow overflow-y-auto p-2">
        {mocks.length === 0 ? (
          <div className="text-center text-gray-500 p-8">
            <p>No mocks configured yet.</p>
            <p>Click "New" to create one.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {mocks.map(mock => (
              <li key={mock.id} className="bg-gray-700/50 rounded-md p-3 group">
                <div className="flex justify-between items-center">
                  <div className="flex-1 overflow-hidden">
                    <p className="font-semibold truncate">{mock.name}</p>
                    <div className="flex items-center text-sm text-gray-400 font-mono mt-1">
                      <span className={`font-bold w-16 ${getMethodColor(mock.matcher.method)}`}>{mock.matcher.method}</span>
                      <span className="truncate">{mock.matcher.path}</span>
                    </div>
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MockList;
