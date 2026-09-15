import { afterEach, expect, it, vi } from "vitest";

// @ts-expect-error Node's strip-types runner requires the explicit extension.
import { businessApi } from "../src/lib/business-api.ts";

afterEach(() => vi.unstubAllGlobals());

it("business leads use the same-origin server proxy", async () => {
  let requestedUrl = "";

  vi.stubGlobal("fetch", (async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch);

  await businessApi.list();
  expect(requestedUrl).toBe("/api/v1/business/leads");
});
