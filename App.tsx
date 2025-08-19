
import React, { useState, useCallback } from 'react';
import { Mock, LiveRequest, MockResponse, LogEntry } from './types';
import MockList from './components/MockList';
import ApiSimulator from './components/ApiSimulator';
import RequestLog from './components/RequestLog';
import MockFormModal from './components/MockFormModal';
import { findMatchingMock } from './services/matcher';

const App: React.FC = () => {
  const [mocks, setMocks] = useState<Mock[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [editingMock, setEditingMock] = useState<Mock | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddMock = () => {
    setEditingMock(null);
    setIsModalOpen(true);
  };

  const handleEditMock = (mock: Mock) => {
    setEditingMock(mock);
    setIsModalOpen(true);
  };

  const handleDeleteMock = (id: string) => {
    setMocks(mocks.filter(m => m.id !== id));
  };

  const handleSaveMock = (mock: Mock) => {
    const index = mocks.findIndex(m => m.id === mock.id);
    if (index > -1) {
      const newMocks = [...mocks];
      newMocks[index] = mock;
      setMocks(newMocks);
    } else {
      setMocks([mock, ...mocks]);
    }
  };
  
  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleSimulatedRequest = useCallback(async (request: LiveRequest): Promise<MockResponse> => {
    const matchedMock = findMatchingMock(request, mocks);

    if (matchedMock) {
        const logEntry: LogEntry = {
            id: Date.now().toString(),
            request,
            matchedMock,
            actualResponse: {
                status: matchedMock.response.status,
                body: matchedMock.response.body,
            },
        };
        await new Promise(resolve => setTimeout(resolve, matchedMock.response.delay));
        setLogs(prev => [logEntry, ...prev]);
        return matchedMock.response;
    } 
    
    // No match
    const query = request.queryParams.length > 0 
        ? '?' + new URLSearchParams(request.queryParams.map(p => [p.key, p.value])).toString()
        : '';
    const fullUrl = `${request.path}${query}`;

    const headersObject = request.headers.reduce((acc, header) => {
        acc[header.key] = header.value;
        return acc;
    }, {} as Record<string, string>);

    const errorBody = {
        error: "No mock match found for the following request:",
        request: {
            method: request.method,
            url: fullUrl,
            headers: headersObject,
            body: request.body || null,
        }
    };
    const errorBodyString = JSON.stringify(errorBody, null, 2);
    
    const noMatchResponse: MockResponse = {
        status: 404,
        body: errorBodyString,
        delay: 0,
        headers: [{ id: 'content-type-json', key: 'Content-Type', value: 'application/json' }]
    };
    
    const logEntry: LogEntry = {
        id: Date.now().toString(),
        request,
        matchedMock: undefined,
        actualResponse: {
            status: noMatchResponse.status,
            body: noMatchResponse.body,
        },
    };

    setLogs(prev => [logEntry, ...prev]);

    return noMatchResponse;
  }, [mocks]);

  return (
    <div className="h-screen w-screen p-4 bg-gray-900 text-gray-100">
      <header className="mb-4">
        <h1 className="text-3xl font-bold text-center">Mock API Server</h1>
        <p className="text-center text-gray-400">Configure mock endpoints and test them with the API simulator.</p>
      </header>
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 8rem)' }}>
        <div className="lg:col-span-1">
          <MockList
            mocks={mocks}
            onAdd={handleAddMock}
            onEdit={handleEditMock}
            onDelete={handleDeleteMock}
          />
        </div>
        <div className="lg:col-span-1">
          <ApiSimulator onSendRequest={handleSimulatedRequest} />
        </div>
        <div className="lg:col-span-1">
          <RequestLog logs={logs} clearLogs={handleClearLogs} />
        </div>
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
