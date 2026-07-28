export declare const DEFAULT_SESSION_BINDINGS_FILE: string;
export declare class SessionBindingStore {
    private readonly filePath;
    private readonly bindings;
    constructor(filePath?: string);
    loadFromDisk(): void;
    get(sessionKey: string): number | undefined;
    set(sessionKey: string, accountIndex: number): void;
    delete(sessionKey: string): void;
    private saveToDisk;
}
//# sourceMappingURL=session-bindings.d.ts.map