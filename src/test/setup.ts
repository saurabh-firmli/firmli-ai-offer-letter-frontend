import { expect, vi } from "vitest";

/**
 * Shared test setup. Runs for every test file, including pure-logic ones with no DOM,
 * so the jsdom-only pieces are guarded.
 */
if (typeof window !== "undefined") {
  const matchers = await import("@testing-library/jest-dom/matchers");
  expect.extend(matchers as never);

  // jsdom implements neither of these, and Mantine calls both.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as never;
  }

  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as never;
  }

  // Mantine's Modal and Drawer scroll-lock the body through this.
  if (!window.scrollTo) {
    window.scrollTo = vi.fn() as never;
  }
}
