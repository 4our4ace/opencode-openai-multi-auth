/**
 * Helper functions for the custom fetch implementation
 * These functions break down the complex fetch logic into manageable, testable units
 */
import type { Auth } from "@opencode-ai/sdk";
import type { OpencodeClient } from "@opencode-ai/sdk";
import type { UserConfig, RequestBody } from "../types.js";
/**
 * Determines if the current auth token needs to be refreshed
 * @param auth - Current authentication state
 * @returns True if token is expired or invalid
 */
export declare function shouldRefreshToken(auth: Auth): boolean;
/**
 * Refreshes the OAuth token and updates stored credentials
 * @param currentAuth - Current auth state
 * @param client - Opencode client for updating stored credentials
 * @returns Updated auth (throws on failure)
 */
export declare function refreshAndUpdateToken(currentAuth: Auth, client: OpencodeClient): Promise<Auth>;
/**
 * Extracts URL string from various request input types
 * @param input - Request input (string, URL, or Request object)
 * @returns URL string
 */
export declare function extractRequestUrl(input: Request | string | URL): string;
/**
 * Rewrites OpenAI API URLs to Codex backend URLs
 * @param url - Original URL
 * @returns Rewritten URL for Codex backend
 */
export declare function rewriteUrlForCodex(url: string): string;
/**
 * Validate that outbound requests target only the trusted Codex backend endpoint.
 * @param url - Rewritten URL
 * @returns Same URL when trusted
 * @throws Error when URL is not the exact trusted endpoint
 */
export declare function validateCodexBackendUrl(url: string): string;
/**
 * Transforms request body and logs the transformation
 * Fetches model-specific Codex instructions based on the request model
 *
 * @param init - Request init options
 * @param url - Request URL
 * @param userConfig - User configuration
 * @param codexMode - Enable CODEX_MODE (bridge prompt instead of tool remap)
 * @returns Transformed body and updated init, or undefined if no body
 */
export declare function transformRequestForCodex(init: RequestInit | undefined, url: string, userConfig: UserConfig, codexMode?: boolean): Promise<{
    body: RequestBody;
    updatedInit: RequestInit;
} | undefined>;
/**
 * Creates headers for Codex API requests
 * @param init - Request init options
 * @param accountId - ChatGPT account ID
 * @param accessToken - OAuth access token
 * @returns Headers object with all required Codex headers
 */
export declare function createCodexHeaders(init: RequestInit | undefined, accountId: string, accessToken: string, opts?: {
    model?: string;
    promptCacheKey?: string;
}): Headers;
/**
 * Handles error responses from the Codex API
 * @param response - Error response from API
 * @returns Original response or mapped retryable response
 */
export declare function handleErrorResponse(response: Response): Promise<Response>;
/**
 * Handles successful responses from the Codex API
 * Passes through Codex backend response for parity with upstream plugin.
 * @param response - Success response from API
 * @param _isStreaming - Preserved for compatibility with current call sites
 * @returns Response passthrough with normalized content-type header
 */
export declare function handleSuccessResponse(response: Response, _isStreaming: boolean): Promise<Response>;
//# sourceMappingURL=fetch-helpers.d.ts.map