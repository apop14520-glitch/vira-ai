import assert from "node:assert/strict";
import { test } from "node:test";

// @ts-expect-error Node's strip-types runner requires the explicit extension.
import { businessApi } from "../src/lib/business-api.ts";

test("business leads use the same-origin server proxy", async () => {
  const originalFetch = globalThis.fetch;
  let requestedUrl = "";

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requestedUrl = String(input);
    return new Response("[]", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await businessApi.list();
    assert.equal(requestedUrl, "/api/business/leads");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
