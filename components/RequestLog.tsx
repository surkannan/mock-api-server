
import React, { useState } from 'react';
import { LogEntry } from '../types';
import ChevronDownIcon from './icons/ChevronDownIcon';
import ChevronUpIcon from './icons/ChevronUpIcon';

interface RequestLogProps {
  logs: LogEntry[];
  clearLogs: () => void;
}

const getStatusColor = (status: number) => {
    if (status >= 500) return 'bg-red-500/30 text-red-300';
    if (status >= 400) return 'bg-yellow-500/30 text-yellow-300';
    if (status >= 200) return 'bg-green-500/30 text-green-300';
    return 'bg-gray-500/30 text-gray-300';
};

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

const LogItem: React.FC<{ log: LogEntry }> = ({ log }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <li className="bg-gray-700/50 rounded-md">
        <div className="p-3 cursor-pointer flex justify-between items-center" onClick={() => setIsOpen(!isOpen)}>
            <div className="flex items-center space-x-3 flex-1 overflow-hidden">
                <span className={`px-2 py-1 rounded-md text-xs font-bold ${getStatusColor(log.actualResponse.status)}`}>
                    {log.actualResponse.status}
                </span>
                <span className={`font-bold w-14 ${getMethodColor(log.request.method)}`}>{log.request.method}</span>
                <span className="truncate font-mono text-sm text-gray-300">{log.request.path}</span>
            </div>
            <div className="flex items-center space-x-3">
                <span className="text-xs text-gray-500">{log.request.timestamp.toLocaleTimeString()}</span>
                {isOpen ? <ChevronUpIcon className="w-5 h-5 text-gray-400"/> : <ChevronDownIcon className="w-5 h-5 text-gray-400"/>}
            </div>
        </div>
        {isOpen && (
            <div className="p-4 border-t border-gray-600 bg-gray-900/30 rounded-b-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div>
                        <h4 className="font-bold text-gray-400 mb-1">Matched Mock</h4>
                        <p className="text-gray-200">{log.matchedMock?.name || <span className="text-gray-500 italic">None</span>}</p>
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-400 mb-1">Request Body</h4>
                        <pre className="whitespace-pre-wrap break-all text-gray-300">{log.request.body || <span className="text-gray-500 italic">Empty</span>}</pre>
                    </div>
                     <div>
                        <h4 className="font-bold text-gray-400 mb-1">Response Body</h4>
                        <pre className="whitespace-pre-wrap break-all text-gray-300">{log.actualResponse.body || <span className="text-gray-500 italic">Empty</span>}</pre>
                    </div>
                </div>
            </div>
        )}
    </li>
  );
};


const RequestLog: React.FC<RequestLogProps> = ({ logs, clearLogs }) => {
  return (
    <div className="bg-gray-800 rounded-lg shadow-lg flex flex-col h-full">
      <div className="p-4 border-b border-gray-700 flex justify-between items-center">
        <h2 className="text-xl font-bold">Request Log</h2>
        <button onClick={clearLogs} className="px-3 py-2 bg-red-600/50 hover:bg-red-500/50 rounded-md text-sm text-red-200 font-medium">
          Clear
        </button>
      </div>
      <div className="flex-grow overflow-y-auto p-2">
        {logs.length === 0 ? (
          <div className="text-center text-gray-500 p-8">
            <p>Awaiting requests...</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {logs.map(log => (
              <LogItem key={log.id} log={log} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default RequestLog;
