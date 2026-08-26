import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Testing Library's auto-cleanup normally hooks into a global `afterEach`,
// which this project doesn't enable (test.globals isn't set — explicit
// imports are used everywhere else for consistency). Registering it
// manually here is what actually unmounts each test's render between
// tests; without it, DOM from a previous test leaks into the next one.
afterEach(() => {
  cleanup();
});
