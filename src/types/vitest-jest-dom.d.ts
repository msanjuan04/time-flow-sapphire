// Hace visibles para tsc los matchers de jest-dom (toBeInTheDocument, ...)
// que vitest.setup.ts registra en tiempo de ejecución pero queda fuera de "include".
import "@testing-library/jest-dom/vitest";
