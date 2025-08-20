
import React, { useState, useEffect } from 'react';
import { Mock, HttpMethod, KeyValue } from '../types';
import TrashIcon from './icons/TrashIcon';
import PlusIcon from './icons/PlusIcon';

interface MockFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (mock: Mock) => void;
  initialMock: Mock | null;
}

const getInitialMockData = (): Mock => ({
  id: Date.now().toString(),
  name: '',
  matcher: {
    method: 'GET',
    path: '/',
    headers: [],
    queryParams: [],
    body: '',
  },
  response: {
    status: 200,
    headers: [],
    body: '',
    delay: 0,
  },
});

const KeyValueEditor: React.FC<{
  title: string;
  items: KeyValue[];
  setItems: React.Dispatch<React.SetStateAction<KeyValue[]>>;
}> = ({ title, items, setItems }) => {
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
    <div>
      <h4 className="text-md font-semibold text-gray-300 mb-2">{title}</h4>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="Key"
              value={item.key}
              onChange={(e) => handleItemChange(item.id, 'key', e.target.value)}
              className="w-1/2 bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Value"
              value={item.value}
              onChange={(e) => handleItemChange(item.id, 'value', e.target.value)}
              className="w-1/2 bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-300 p-1">
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        ))}
      </div>
      <button onClick={addItem} className="mt-2 flex items-center text-sm text-blue-400 hover:text-blue-300">
        <PlusIcon className="w-4 h-4 mr-1" />
        Add {title.slice(0, -1)}
      </button>
    </div>
  );
};

const MockFormModal: React.FC<MockFormModalProps> = ({ isOpen, onClose, onSave, initialMock }) => {
  const [mock, setMock] = useState<Mock>(getInitialMockData());

  useEffect(() => {
    setMock(initialMock ? JSON.parse(JSON.stringify(initialMock)) : getInitialMockData());
  }, [initialMock, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(mock);
    onClose();
  };
  
  const setMatcher = (update: Partial<Mock['matcher']>) => setMock(prev => ({...prev, matcher: {...prev.matcher, ...update}}));
  const setResponse = (update: Partial<Mock['response']>) => setMock(prev => ({...prev, response: {...prev.response, ...update}}));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-xl font-bold">{initialMock ? 'Edit Mock' : 'Create New Mock'}</h2>
        </div>
        <div className="p-6 space-y-6 overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Mock Name</label>
            <input
              type="text"
              placeholder="e.g., Get User Success"
              value={mock.name}
              onChange={(e) => setMock({...mock, name: e.target.value})}
              className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Request Matcher */}
            <div className="bg-gray-700/50 p-4 rounded-lg space-y-4">
              <h3 className="text-lg font-semibold border-b border-gray-600 pb-2">Request Matcher</h3>
              <div className="flex items-center space-x-2">
                <select
                  value={mock.matcher.method}
                  onChange={(e) => setMatcher({ method: e.target.value as HttpMethod })}
                  className="bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'].map(m => <option key={m}>{m}</option>)}
                </select>
                <input
                  type="text"
                  placeholder="/api/users/:id"
                  value={mock.matcher.path}
                  onChange={(e) => setMatcher({ path: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <KeyValueEditor title="Query Params" items={mock.matcher.queryParams} setItems={(items) => setMatcher({queryParams: items as KeyValue[]})} />
              <KeyValueEditor title="Headers" items={mock.matcher.headers} setItems={(items) => setMatcher({headers: items as KeyValue[]})} />
              <div>
                <h4 className="text-md font-semibold text-gray-300 mb-2">Body Contains</h4>
                <textarea
                  placeholder='{"key": "value"}'
                  value={mock.matcher.body}
                  onChange={(e) => setMatcher({ body: e.target.value })}
                  className="w-full h-24 bg-gray-900 border border-gray-600 rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Mock Response */}
            <div className="bg-gray-700/50 p-4 rounded-lg space-y-4">
              <h3 className="text-lg font-semibold border-b border-gray-600 pb-2">Mock Response</h3>
              <div className="flex items-center space-x-2">
                 <label className="text-sm font-medium text-gray-400">Status</label>
                 <input
                  type="number"
                  value={mock.response.status}
                  onChange={(e) => setResponse({ status: parseInt(e.target.value, 10) })}
                  className="w-24 bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <label className="text-sm font-medium text-gray-400">Delay (ms)</label>
                <input
                  type="number"
                  value={mock.response.delay}
                  onChange={(e) => setResponse({ delay: parseInt(e.target.value, 10) })}
                  className="w-24 bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <KeyValueEditor title="Headers" items={mock.response.headers} setItems={(items) => setResponse({headers: items as KeyValue[]})} />
              <div>
                <h4 className="text-md font-semibold text-gray-300 mb-2">Body</h4>
                <textarea
                  placeholder='{"message": "Success!"}'
                  value={mock.response.body}
                  onChange={(e) => setResponse({ body: e.target.value })}
                  className="w-full h-24 bg-gray-900 border border-gray-600 rounded-md px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {/* Cheatsheet */}
                <details className="mt-3 bg-gray-800/60 border border-gray-700 rounded-md">
                  <summary className="px-3 py-2 text-sm font-medium cursor-pointer select-none">Templating Cheatsheet</summary>
                  <div className="px-3 py-3 text-xs text-gray-300 space-y-2">
                    <div>
                      <div className="font-semibold text-gray-200 mb-1">Placeholders</div>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Request: <code className="bg-gray-900 px-1 rounded">{`{{method}}`}</code>, <code className="bg-gray-900 px-1 rounded">{`{{path}}`}</code>, <code className="bg-gray-900 px-1 rounded">{`{{url}}`}</code></li>
                        <li>Headers: <code className="bg-gray-900 px-1 rounded">{`{{headers.authorization}}`}</code></li>
                        <li>Query: <code className="bg-gray-900 px-1 rounded">{`{{query.page}}`}</code></li>
                        <li>Body: <code className="bg-gray-900 px-1 rounded">{`{{body}}`}</code>, JSON fields: <code className="bg-gray-900 px-1 rounded">{`{{bodyJson.userId}}`}</code></li>
                        <li>Time/IDs: <code className="bg-gray-900 px-1 rounded">{`{{isoNow}}`}</code>, <code className="bg-gray-900 px-1 rounded">{`{{epochMs}}`}</code>, <code className="bg-gray-900 px-1 rounded">{`{{uuid}}`}</code></li>
                      </ul>
                    </div>
                    <div>
                      <div className="font-semibold text-gray-200 mb-1">JS Expressions</div>
                      <p>Use <code className="bg-gray-900 px-1 rounded">{`{{= <expr>}}`}</code> or <code className="bg-gray-900 px-1 rounded">{`{{js: <expr>}}`}</code>. Context: <code className="bg-gray-900 px-1 rounded">method</code>, <code className="bg-gray-900 px-1 rounded">path</code>, <code className="bg-gray-900 px-1 rounded">headers</code>, <code className="bg-gray-900 px-1 rounded">query</code>, <code className="bg-gray-900 px-1 rounded">body</code>, <code className="bg-gray-900 px-1 rounded">bodyJson</code>, <code className="bg-gray-900 px-1 rounded">isoNow</code>, <code className="bg-gray-900 px-1 rounded">epochMs</code>, <code className="bg-gray-900 px-1 rounded">uuid</code>.</p>
                      <p>Helpers: <code className="bg-gray-900 px-1 rounded">helpers.upper(s)</code>, <code className="bg-gray-900 px-1 rounded">helpers.lower(s)</code>, <code className="bg-gray-900 px-1 rounded">helpers.base64(s)</code>, <code className="bg-gray-900 px-1 rounded">helpers.json(o)</code>, <code className="bg-gray-900 px-1 rounded">helpers.parseJson(s)</code>, <code className="bg-gray-900 px-1 rounded">helpers.randomInt(min,max)</code>.</p>
                      <div className="mt-2 bg-gray-900 border border-gray-700 rounded p-2 font-mono text-[11px] leading-5 overflow-x-auto">
                        {`{
  "id": "{{uuid}}",
  "user": "{{= (bodyJson && bodyJson.user && bodyJson.user.name) || 'anon' }}",
  "echo": {{= helpers.json(bodyJson) }},
  "token": "{{helpers.base64(headers.authorization)}}",
  "at": "{{isoNow}}"
}`}
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 flex justify-end space-x-3 bg-gray-800 border-t border-gray-700">
          <button onClick={onClose} className="px-4 py-2 bg-gray-600 hover:bg-gray-500 rounded-md text-sm font-medium">Cancel</button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-md text-sm font-medium">Save Mock</button>
        </div>
      </div>
    </div>
  );
};

export default MockFormModal;
