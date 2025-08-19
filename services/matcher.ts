import { Mock, LiveRequest } from '../types';

const pathMatches = (template: string, actual: string): boolean => {
  // Normalize path by removing a single trailing slash if it exists, but not from the root path '/'
  const normalizedActual = actual.length > 1 && actual.endsWith('/') ? actual.slice(0, -1) : actual;

  // Escape all special regex characters from the template path, but leave '/', ':', and '*' alone for our patterns.
  let regexString = template.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  
  // The order of replacement is critical. Handle the most specific (`**`) before the more general (`*`).
  
  // Replace `**` with a group that matches anything (including slashes).
  regexString = regexString.replace(/\*\*/g, '(.*)');
  
  // Replace `:param` with a group that matches anything but a slash.
  regexString = regexString.replace(/:[a-zA-Z0-9_]+/g, '([^/]+)');
  
  // Replace `*` with a group that matches anything but a slash.
  regexString = regexString.replace(/\*/g, '([^/]+)');
  
  // Anchor the regex to match the whole string.
  try {
    const regex = new RegExp(`^${regexString}$`);
    return regex.test(normalizedActual);
  } catch (e) {
    console.error("Invalid path pattern:", template, e);
    return false;
  }
};


const valueMatches = (expected: string, actual: string): boolean => {
  try {
    // Attempt to create a regex from the expected value.
    const regex = new RegExp(expected);
    return regex.test(actual);
  } catch (e) {
    // If the expected value is not a valid regex, fall back to simple substring matching.
    return actual.includes(expected);
  }
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
        valueMatches(mockHeader.value, reqHeader.value)
      )
    );
    if (!allHeadersMatch) continue;
    
    const definedMatcherQueryParams = matcher.queryParams.filter(q => q.key);
    const allQueryParamsMatch = definedMatcherQueryParams.every(mockQueryParam =>
      request.queryParams.some(reqQueryParam =>
        reqQueryParam.key === mockQueryParam.key &&
        valueMatches(mockQueryParam.value, reqQueryParam.value)
      )
    );
    if (!allQueryParamsMatch) continue;

    if (matcher.body && !valueMatches(matcher.body, request.body || '')) {
      continue;
    }

    return mock;
  }

  return null;
};
