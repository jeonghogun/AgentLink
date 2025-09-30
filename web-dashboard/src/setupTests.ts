import '@testing-library/jest-dom/vitest';
import 'whatwg-fetch';

vi.mock('react-hot-toast', async () => {
  const actual = await vi.importActual<typeof import('react-hot-toast')>('react-hot-toast');
  return {
    ...actual,
    toast: {
      ...actual.toast,
      success: vi.fn(),
      error: vi.fn(),
      custom: vi.fn(),
    },
  };
});
