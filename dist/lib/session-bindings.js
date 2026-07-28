import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ensureSecureFile, writeJsonSecure } from "./secure-file.js";
export const DEFAULT_SESSION_BINDINGS_FILE = join(homedir(), ".config", "opencode", "openai-multi-auth-session-bindings.json");
export class SessionBindingStore {
    filePath;
    bindings = new Map();
    constructor(filePath = DEFAULT_SESSION_BINDINGS_FILE) {
        this.filePath = filePath;
    }
    loadFromDisk() {
        this.bindings.clear();
        if (!existsSync(this.filePath))
            return;
        ensureSecureFile(this.filePath);
        try {
            const raw = readFileSync(this.filePath, "utf8");
            const parsed = JSON.parse(raw);
            const loaded = parsed?.bindings;
            if (!loaded || typeof loaded !== "object")
                return;
            for (const [sessionKey, accountIndex] of Object.entries(loaded)) {
                if (!sessionKey)
                    continue;
                if (!Number.isInteger(accountIndex) || accountIndex < 0)
                    continue;
                this.bindings.set(sessionKey, accountIndex);
            }
        }
        catch {
            // Ignore malformed files; plugin continues with in-memory map.
        }
    }
    get(sessionKey) {
        return this.bindings.get(sessionKey);
    }
    set(sessionKey, accountIndex) {
        this.bindings.set(sessionKey, accountIndex);
        this.saveToDisk();
    }
    delete(sessionKey) {
        if (!this.bindings.delete(sessionKey))
            return;
        this.saveToDisk();
    }
    saveToDisk() {
        try {
            const payload = {
                version: 1,
                bindings: Object.fromEntries(this.bindings.entries()),
            };
            writeJsonSecure(this.filePath, payload);
        }
        catch {
            // Persistence failure should not break request handling.
        }
    }
}
//# sourceMappingURL=session-bindings.js.map