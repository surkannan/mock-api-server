import { Mock, LiveRequest } from '../types';

const pathMatches = (template: string, actual: string): boolean => {
  if (!template.includes(':')) {
    return template === actual;
  }
  const templateParts = template.split('/').filter(p => p);
  const actualParts = actual.split('/').filter(p => p);
  if (templateParts.length !== actualParts.length) {
    return false;
  }
  return templateParts.every((part, i) => {
    return part.startsWith(':') || part === actualParts[i];
  });
};

export const findMatchingMock = (request: LiveRequest, mocks: Mock[]): Mock | null => {
  for (const mock of mocks) {
    const matcher = mock.matcher;

    if (matcher.method !== request.method) continue;

    const [requestPath] = request.path.split('?');
    if (!pathMatches(matcher.path, requestPath)) continue;

    const definedMatcherHeaders = matcher.headers.filter(h => h.key);
    const allHeadersMatch = definedMatcherHeaders.every(mockHeader =>
      request.headers.some(reqHeader =>
        reqHeader.key.toLowerCase() === mockHeader.key.toLowerCase() &&
        reqHeader.value.includes(mockHeader.value)
      )
    );
    if (!allHeadersMatch) continue;
    
    const definedMatcherQueryParams = matcher.queryParams.filter(q => q.key);
    const allQueryParamsMatch = definedMatcherQueryParams.every(mockQueryParam =>
      request.queryParams.some(reqQueryParam =>
        reqQueryParam.key === mockQueryParam.key &&
        reqQueryParam.value.includes(mockQueryParam.value)
      )
    );
    if (!allQueryParamsMatch) continue;

    if (matcher.body && !request.body?.includes(matcher.body)) {
      continue;
    }

    return mock;
  }

  return null;
};
