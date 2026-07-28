import type { OAuthServerInfo } from "../types.js";
/**
 * Start a small local HTTP server that waits for /auth/callback and returns the code
 * @param options - OAuth state for validation
 * @returns Promise that resolves to server info
 */
export declare function startLocalOAuthServer({ state }: {
    state: string;
}): Promise<OAuthServerInfo>;
//# sourceMappingURL=server.d.ts.map