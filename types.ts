

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'OPTIONS' | 'HEAD';

export interface KeyValue {
  id: string;
  key: string;
  value: string;
}

export interface RequestMatcher {
  method: HttpMethod;
  path: string;
  headers: KeyValue[];
  body?: string;
  queryParams: KeyValue[];
}

export interface MockResponse {
  status: number;
  headers: KeyValue[];
  body?: string;
  delay: number;
}

export interface Mock {
  id: string;
  name: string;
  matcher: RequestMatcher;
  response: MockResponse;
}

export interface LiveRequest {
  id: string;
  timestamp: Date;
  method: HttpMethod;
  path: string;
  headers: KeyValue[];
  queryParams: KeyValue[];
  body?: string;
}

export interface LogEntry {
  id: string;
  request: LiveRequest;
  matchedMock?: Mock | null;
  actualResponse: {
    status: number;
    body?: string;
  };
}
