import '@testing-library/jest-dom/vitest';

// Node 22+ expone un `localStorage` global experimental (Web Storage) que,
// sin --localstorage-file, no tiene métodos y pisa al de jsdom. Instalamos
// una implementación en memoria para que el código de la app (colas
// offline, PIN del kiosco) funcione igual que en el navegador.
const hasWorkingStorage = (s: unknown) =>
  !!s && typeof (s as Storage).getItem === 'function' && typeof (s as Storage).setItem === 'function';

const createMemoryStorage = (): Storage => {
  let store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => {
      store = new Map();
    },
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  } as Storage;
};

for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (!hasWorkingStorage((globalThis as Record<string, unknown>)[name])) {
    const storage = createMemoryStorage();
    Object.defineProperty(globalThis, name, { value: storage, configurable: true, writable: true });
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, name, { value: storage, configurable: true, writable: true });
    }
  }
}

beforeEach(() => {
  window.localStorage.clear();
});
