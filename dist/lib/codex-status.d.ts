import type { ManagedAccount } from "./accounts/types.js";
export interface CodexRateLimitSnapshot {
    key?: string;
    accountId: string;
    email: string;
    plan: string;
    backendPlan?: string;
    updatedAt: number;
    primary: {
        usedPercent: number;
        windowMinutes: number;
        resetAt: number;
    } | null;
    secondary: {
        usedPercent: number;
        windowMinutes: number;
        resetAt: number;
    } | null;
    credits: {
        hasCredits: boolean;
        unlimited: boolean;
        balance: string;
    } | null;
}
export declare class CodexStatusManager {
    private snapshots;
    private initPromise;
    private ensureInitialized;
    private getSnapshotKey;
    updateFromHeaders(account: ManagedAccount, headers: Record<string, string | string[] | undefined>): Promise<void>;
    getSnapshot(account: ManagedAccount): Promise<(CodexRateLimitSnapshot & {
        isStale: boolean;
    }) | null>;
    getAllSnapshots(): Promise<CodexRateLimitSnapshot[]>;
    renderStatus(account: ManagedAccount): Promise<string[]>;
    updateFromSnapshot(account: ManagedAccount, snapshot: any): Promise<void>;
    fetchFromBackend(account: ManagedAccount, accessToken: string): Promise<void>;
    private loadFromDisk;
    private saveToDisk;
}
export declare const codexStatus: CodexStatusManager;
//# sourceMappingURL=codex-status.d.ts.map