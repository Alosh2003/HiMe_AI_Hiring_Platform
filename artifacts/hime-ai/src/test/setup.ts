import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './msw';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Point the app at a fake origin so MSW intercepts every request
process.env.VITE_API_BASE_URL = 'http://localhost:5000';

const TOKEN_KEY = 'hime_ai_token';
const USER_KEY = 'hime_ai_user';

const DEFAULT_USER = {
  id: 'f14e27ff-7e71-40af-8335-8b28c44852c7',
  email: 'seeker@hime.ai',
  name: 'ليان العتيبي',
  role: 'seeker',
};

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));

// Reset to a known signed-in state BEFORE every test
beforeAll(() => {
  window.localStorage.setItem(TOKEN_KEY, 'test-jwt-token');
  window.localStorage.setItem(USER_KEY, JSON.stringify(DEFAULT_USER));
});

afterEach(() => {
  server.resetHandlers();
  // Restore a clean signed-in state after each test
  window.localStorage.setItem(TOKEN_KEY, 'test-jwt-token');
  window.localStorage.setItem(USER_KEY, JSON.stringify(DEFAULT_USER));
});

afterAll(() => server.close());