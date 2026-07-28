import type { ManagedAccount, MultiAccountConfig } from "./types.js";
export declare class AccountManager {
    private accounts;
    private activeIndex;
    private roundRobinCursor;
    private strategyInitialized;
    private config;
    constructor(config?: Partial<MultiAccountConfig>);
    loadFromDisk(): Promise<void>;
    saveToDisk(): Promise<void>;
    importFromOpenCodeAuth(): Promise<void>;
    addAccount(email: string | undefined, refreshToken: string, accessToken?: string, expires?: number): Promise<ManagedAccount>;
    getAllAccounts(): ManagedAccount[];
    getAccountCount(): number;
    getNextAvailableAccount(model?: string): Promise<ManagedAccount | null>;
    getNextAvailableAccountForNewSession(model?: string): Promise<ManagedAccount | null>;
    private selectNextAvailableAccount;
    private normalizeIndex;
    private initializeStrategyState;
    private isAccountAvailable;
    private getLeastRateLimitedAccount;
    markRateLimited(account: ManagedAccount, retryAfterMs: number, model?: string): void;
    markRefreshFailed(account: ManagedAccount, error: string): void;
    removeAccount(account: ManagedAccount): void;
    updateAccountTokens(account: ManagedAccount, accessToken: string, refreshToken: string, expires: number): Promise<void>;
    ensureValidToken(account: ManagedAccount): Promise<boolean>;
    getActiveAccount(): ManagedAccount | null;
    /**
     * Get the next available account excluding the specified account indices.
     * Used for model fallback retry logic - try other accounts before falling back to older model.
     */
    getNextAvailableAccountExcluding(excludeIndices: Set<number>, model?: string): Promise<ManagedAccount | null>;
    /**
     * Check if an account supports a specific model based on plan type.
     * GPT-5.3-codex requires Plus/Pro/Team - free accounts don't support it.
     */
    accountSupportsModel(account: ManagedAccount, model: string): boolean;
    /**
     * Get accounts that might support a model (non-free for gpt-5.3-*)
     */
    getAccountsSupportingModel(model: string): ManagedAccount[];
}
//# sourceMappingURL=manager.d.ts.map