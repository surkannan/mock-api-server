import React, { useState } from 'react';
import { HttpMethod, KeyValue, MockResponse } from '../types';
import TrashIcon from './icons/TrashIcon';
import PlusIcon from './icons/PlusIcon';

const KeyValueInput: React.FC<{
  items: KeyValue[];
  setItems: React.Dispatch<React.SetStateAction<KeyValue[]>>;
}> = ({ items, setItems }) => {
  const handleItemChange = (id: string, field: 'key' | 'value', value: string) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const addItem = () => {
    setItems([...items, { id: Date.now().toString(), key: '', value: '' }]);
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };
  
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="flex items-center space-x-2">
          <input type="text" placeholder="Key" value={item.key} onChange={(e) => handleItemChange(item.id, 'key', e.target.value)} className="w-1/2 bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input type="text" placeholder="Value" value={item.value} onChange={(e) => handleItemChange(item.id, 'value', e.target.value)} className="w-1/2 bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-300 p-1"><TrashIcon className="w-5 h-5" /></button>
        </div>
      ))}
      <button onClick={addItem} className="mt-2 flex items-center text-sm text-blue-400 hover:text-blue-300"><PlusIcon className="w-4 h-4 mr-1" />Add</button>
    </div>
  );
};

const ApiSimulator: React.FC = () => {
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [path, setPath] = useState<string>('/users/1');
  const [headers, setHeaders] = useState<KeyValue[]>([]);
  const [body, setBody] = useState<string>('');
  const [response, setResponse] = useState<MockResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getStatusColor = (status: number) => {
    if (status >= 500) return 'text-red-400';
    if (status >= 400) return 'text-yellow-400';
    if (status >= 200) return 'text-green-400';
    return 'text-gray-400';
  };
  
  const handleSend = async () => {
    setIsLoading(true);
    setResponse(null);

    const fullPath = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(fullPath, window.location.origin);
    
    const requestHeaders = new Headers();
    headers.filter(h => h.key).forEach(h => requestHeaders.append(h.key, h.value));

    try {
        const fetchResponse = await fetch(url.toString(), {
            method,
            headers: requestHeaders,
            body: (method !== 'GET' && method !== 'HEAD' && body) ? body : undefined,
        });

        const responseBody = await fetchResponse.text();
        const responseHeadersResult: KeyValue[] = [];
        fetchResponse.headers.forEach((value, key) => {
            responseHeadersResult.push({ id: key, key, value });
        });

        setResponse({
            status: fetchResponse.status,
            body: responseBody,
            headers: responseHeadersResult,
            delay: 0,
        });
    } catch (error) {
        console.error("API Simulator fetch error:", error);
        setResponse({
            status: 503,
            body: `Fetch failed. Is the mock server active?\n\n${(error as Error).message}`,
            headers: [],
            delay: 0,
        });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg shadow-lg flex flex-col h-full">
      <h2 className="text-xl font-bold p-4 border-b border-gray-700">API Simulator</h2>
      <div className="flex-grow p-4 space-y-4 overflow-y-auto">
        <div>
          <h3 className="text-lg font-semibold mb-2">Request</h3>
          <div className="flex items-center space-x-2 bg-gray-700/50 p-2 rounded-md">
            <select value={method} onChange={(e) => setMethod(e.target.value as HttpMethod)} className="bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500">
              {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => <option key={m}>{m}</option>)}
            </select>
            <input type="text" value={path} onChange={(e) => setPath(e.target.value)} placeholder="/api/path?query=param" className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm" />
          </div>
          <div className="mt-4">
            <h4 className="font-semibold text-gray-300 mb-2">Headers</h4>
            <KeyValueInput items={headers} setItems={setHeaders} />
          </div>
          <div className="mt-4">
            <h4 className="font-semibold text-gray-300 mb-2">Body</h4>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} className="w-full h-24 bg-gray-900 border border-gray-600 rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Response</h3>
          <div className="bg-gray-700/50 rounded-md min-h-[200px] p-4 flex flex-col">
            {isLoading ? (
              <div className="m-auto text-center text-gray-400">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-2"></div>
                Sending...
              </div>
            ) : response ? (
              <>
                <div className="flex items-center space-x-4 mb-2">
                  <span className="font-semibold">Status:</span>
                  <span className={`font-bold ${getStatusColor(response.status)}`}>{response.status}</span>
                </div>
                <div>
                  <h4 className="font-semibold mb-1">Body</h4>
                  <pre className="w-full h-full bg-gray-900 border border-gray-600 rounded-md p-2 font-mono text-sm whitespace-pre-wrap break-all overflow-auto">
                    {response.body || '(No Body)'}
                  </pre>
                </div>
              </>
            ) : (
              <div className="m-auto text-gray-500">Send a request to see the response.</div>
            )}
          </div>
        </div>
      </div>
      <div className="p-4 border-t border-gray-700">
        <button onClick={handleSend} disabled={isLoading} className="w-full px-4 py-2 bg-green-600 hover:bg-green-500 rounded-md font-bold disabled:bg-gray-500 disabled:cursor-not-allowed">
          {isLoading ? 'Sending...' : 'Send Request'}
        </button>
      </div>
    </div>
  );
};

export default ApiSimulator;