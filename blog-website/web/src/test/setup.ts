import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "@/test/msw/server";

const routerMock = {
  push: vi.fn(),
  replace: vi.fn(),
  prefetch: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
};

let pathname = "/";
let searchParams = new URLSearchParams();

(globalThis as unknown as { __routerMock?: typeof routerMock }).__routerMock =
  routerMock;
(globalThis as unknown as { __setPathname?: (p: string) => void }).__setPathname =
  (p) => {
    pathname = p;
  };
(globalThis as unknown as { __setSearchParams?: (q: string) => void }).__setSearchParams =
  (q) => {
    searchParams = new URLSearchParams(q);
  };

vi.mock("next/navigation", () => {
  return {
    useRouter: () => routerMock,
    usePathname: () => pathname,
    useSearchParams: () => searchParams,
  };
});

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
