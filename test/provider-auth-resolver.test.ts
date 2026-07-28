import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Account = {
  index: number;
  access?: string;
  accountId?: string;
  expires?: number;
};

let accountSnapshots: Account[][] = [];
let activeAccountIndexes: number[] = [];
let bindingSnapshots: Array<number | undefined> = [];
const ensureValidToken = vi.fn(async () => true);

vi.mock("../lib/accounts/index.js", () => ({
  AccountManager: class {
    private accounts: Account[] = [];
    private activeAccountIndex = 0;

    async loadFromDisk() {
      this.accounts = accountSnapshots.shift() || [];
      this.activeAccountIndex = activeAccountIndexes.shift() || 0;
    }

    getAllAccounts() {
      return this.accounts;
    }

    getActiveAccount() {
      return this.accounts.find((account) => account.index === this.activeAccountIndex) || null;
    }

    ensureValidToken = ensureValidToken;
  },
}));

vi.mock("../lib/session-bindings.js", () => ({
  SessionBindingStore: class {
    loadFromDisk() {}

    get() {
      return bindingSnapshots.shift();
    }
  },
}));

describe("OpenAI provider auth resolver", () => {
  const registrySymbol = Symbol.for("opencode.provider-auth-resolvers.v1");

  beforeEach(() => {
    accountSnapshots = [];
    activeAccountIndexes = [];
    bindingSnapshots = [];
    ensureValidToken.mockClear();
    delete (globalThis as Record<PropertyKey, unknown>)[registrySymbol];
  });

  afterEach(() => {
    delete (globalThis as Record<PropertyKey, unknown>)[registrySymbol];
  });

  it("reloads the session binding and account before each resolution", async () => {
    accountSnapshots = [
      [
        { index: 0, access: "active-access", accountId: "acct_active", expires: 50 },
        { index: 1, access: "first-access", accountId: "acct_first", expires: 100 },
      ],
      [
        { index: 0, access: "second-access", accountId: "acct_second", expires: 200 },
        { index: 1, access: "active-access", accountId: "acct_active", expires: 50 },
      ],
    ];
    activeAccountIndexes = [0, 1];
    bindingSnapshots = [1, 0];
    const { createOpenAIProviderAuthResolver } = await import("../tui.js");
    const resolve = createOpenAIProviderAuthResolver();

    await expect(resolve({ providerID: "openai", sessionID: "ses_1" })).resolves.toEqual({
      access: "first-access",
      accountId: "acct_first",
      expires: 100,
    });
    await expect(resolve({ providerID: "openai", sessionID: "ses_1" })).resolves.toEqual({
      access: "second-access",
      accountId: "acct_second",
      expires: 200,
    });
    expect(ensureValidToken).toHaveBeenCalledTimes(2);
  });

  it("falls back to the freshly loaded active account without a session binding", async () => {
    accountSnapshots = [[
      { index: 0, access: "inactive-access", accountId: "acct_inactive", expires: 100 },
      { index: 1, access: "active-access", accountId: "acct_active", expires: 200 },
    ]];
    activeAccountIndexes = [1];
    bindingSnapshots = [undefined];
    const { createOpenAIProviderAuthResolver } = await import("../tui.js");

    await expect(createOpenAIProviderAuthResolver()({ providerID: "openai", sessionID: "ses_1" })).resolves.toEqual({
      access: "active-access",
      accountId: "acct_active",
      expires: 200,
    });
  });

  it("registers the resolver and unregisters it when the TUI is disposed", async () => {
    const { default: plugin } = await import("../tui.js");
    let dispose: (() => void) | undefined;

    await plugin.tui({
      keymap: { registerLayer: vi.fn() },
      lifecycle: { onDispose: (callback: () => void) => (dispose = callback) },
    } as any);

    const registry = (globalThis as Record<PropertyKey, any>)[registrySymbol];
    expect(registry).toMatchObject({ version: 1 });
    expect(registry.resolvers.get("openai")).toHaveLength(1);

    dispose?.();
    expect(registry.resolvers.has("openai")).toBe(false);
  });
});
