import { describe, expect, it, vi } from "vitest";

vi.mock("@opencode-ai/plugin", () => ({
  tool: (definition: unknown) => definition,
}));

vi.mock("../lib/accounts/index.js", () => ({
  AccountManager: class {
    async loadFromDisk() {}
    async importFromOpenCodeAuth() {}
  },
}));

vi.mock("../lib/session-bindings.js", () => ({
  SessionBindingStore: class {
    loadFromDisk() {}
  },
}));

describe("active plugin marker", () => {
  it("remains set until the last plugin instance is disposed", async () => {
    const { OpenAIAuthPlugin } = await import("../index.js");
    const input = { client: { tui: { showToast: vi.fn() } } } as any;
    const first = (await OpenAIAuthPlugin(input)) as any;
    const second = (await OpenAIAuthPlugin(input)) as any;
    const marker = Symbol.for(
      "@4our4ace/opencode-openai-multi-auth/active",
    );

    expect((globalThis as Record<PropertyKey, unknown>)[marker]).toBe(true);

    await first.dispose();
    expect((globalThis as Record<PropertyKey, unknown>)[marker]).toBe(true);

    await second.dispose();
    expect((globalThis as Record<PropertyKey, unknown>)[marker]).toBeUndefined();
  });
});
