import '@testing-library/jest-dom';

const createLocalStorageMock = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    }
  };
};

const mock = createLocalStorageMock();
Object.defineProperty(globalThis, 'localStorage', {
  value: mock,
  configurable: true,
  writable: true
});

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: mock,
    configurable: true,
    writable: true
  });

  // Polyfill matchMedia for testing responsive / theme components
  if (!window.matchMedia) {
    window.matchMedia = (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
}

// Suppress unhandled happy-dom Animation AbortError during unmounting transitions
process.on('unhandledRejection', (reason: any) => {
  if (reason?.name === 'AbortError' || reason?.message?.includes('animation was canceled')) {
    return;
  }
  // Re-throw any genuine unexpected rejections
  throw reason;
});

