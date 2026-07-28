import { describe, expect, it, vi } from "vitest";

const accounts = [
  { index: 0, email: "pro@example.com", planType: "pro" },
  { index: 1, email: "plus@example.com", planType: "plus" },
];
const setActiveAccount = vi.fn(async (index: number) => accounts[index] ?? null);
const setBinding = vi.fn();

vi.mock("../lib/accounts/index.js", () => ({
  AccountManager: class {
    async loadFromDisk() {}
    getAllAccounts() {
      return accounts;
    }
    getActiveAccount() {
      return accounts[0];
    }
    setActiveAccount = setActiveAccount;
  },
}));

vi.mock("../lib/session-bindings.js", () => ({
  SessionBindingStore: class {
    loadFromDisk() {}
    set = setBinding;
  },
}));

describe("account switch TUI", () => {
  it("opens an email-based picker and binds the selected account to the session", async () => {
    const plugin = (await import("../tui.js")).default;
    let command: any;
    let picker: any;
    const toast = vi.fn();
    const clear = vi.fn();

    await plugin.tui({
      keymap: { registerLayer: ({ commands }: any) => (command = commands[0]) },
      route: { current: { name: "session", params: { sessionID: "session-1" } } },
      ui: {
        toast,
        dialog: { replace: (render: any) => (picker = render()), clear },
        DialogSelect: (props: any) => props,
      },
    } as any);

    await command.run();

    expect(picker.title).toBe("Switch OpenAI account");
    expect(picker.options).toEqual([
      { title: "pro@example.com", value: 0, description: "pro · active" },
      { title: "plus@example.com", value: 1, description: "plus" },
    ]);

    picker.onSelect(picker.options[1]);
    await vi.waitFor(() => expect(setBinding).toHaveBeenCalledWith("session-1", 1));
    expect(clear).toHaveBeenCalledOnce();
    expect(toast).toHaveBeenCalledWith({ message: "Using plus@example.com", variant: "success" });
  });
});
