import { vi } from 'vitest';
import nock from 'nock';

vi.mock('nock', () => ({
  default: nock,
}));

beforeAll(() => {
  nock.disableNetConnect();
});

afterAll(() => {
  nock.enableNetConnect();
});

afterEach(() => {
  nock.cleanAll();
  vi.resetAllMocks();
});

global.fetch = vi.fn();
global.Request = vi.fn();
global.Response = vi.fn();

console.error = vi.fn((message: string) => {
  if (message.includes('Warning:') || message.includes('Deprecation')) {
    return;
  }
  console.error(message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});