// Extends Vitest's `expect` with @testing-library/jest-dom matchers
// (e.g. toBeInTheDocument, toHaveTextContent) and auto-cleans the DOM
// after every test.
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
