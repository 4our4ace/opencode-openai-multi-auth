import { AccountManager } from "./lib/accounts/index.js";
import { SessionBindingStore } from "./lib/session-bindings.js";
const tui = async (api) => {
    const accountManager = new AccountManager({ quietMode: true });
    const sessionBindings = new SessionBindingStore();
    sessionBindings.loadFromDisk();
    api.keymap.registerLayer({
        priority: 1,
        commands: [
            {
                name: "openai.switch-account",
                title: "Switch OpenAI account",
                category: "OpenAI",
                namespace: "palette",
                slashName: "switch-account",
                async run() {
                    await accountManager.loadFromDisk();
                    const accounts = accountManager.getAllAccounts();
                    if (accounts.length === 0) {
                        api.ui.toast({ message: "No OpenAI accounts are configured", variant: "warning" });
                        return;
                    }
                    const sessionID = api.route.current.name === "session" && typeof api.route.current.params?.sessionID === "string"
                        ? api.route.current.params.sessionID
                        : undefined;
                    api.ui.dialog.replace(() => api.ui.DialogSelect({
                        title: "Switch OpenAI account",
                        current: accountManager.getActiveAccount()?.index,
                        options: accounts.map((account) => ({
                            title: account.email || "OpenAI account",
                            value: account.index,
                            description: [account.planType, account.index === accountManager.getActiveAccount()?.index ? "active" : undefined]
                                .filter(Boolean)
                                .join(" · "),
                        })),
                        onSelect: (option) => {
                            void accountManager.setActiveAccount(option.value).then((account) => {
                                api.ui.dialog.clear();
                                if (!account)
                                    return;
                                if (sessionID)
                                    sessionBindings.set(sessionID, account.index);
                                api.ui.toast({ message: `Using ${account.email || "OpenAI account"}`, variant: "success" });
                            });
                        },
                    }));
                },
            },
        ],
    });
};
export default { id: "4our4ace-opencode-openai-multi-auth", tui };
//# sourceMappingURL=tui.js.map