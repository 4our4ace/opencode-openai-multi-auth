/**
 * OpenCode Codex Prompt Fetcher
 *
 * Fetches and caches the codex.txt system prompt from OpenCode's GitHub repository.
 * Uses ETag-based caching to efficiently track updates.
 */
/**
 * Fetch OpenCode's codex.txt prompt with ETag-based caching
 * Uses HTTP conditional requests to efficiently check for updates
 *
 * Rate limit protection: Only checks GitHub if cache is older than 15 minutes
 * @returns The codex.txt content
 */
export declare function getOpenCodeCodexPrompt(): Promise<string>;
/**
 * Get first N characters of the cached OpenCode prompt for verification
 * @param chars Number of characters to get (default: 50)
 * @returns First N characters or null if not cached
 */
export declare function getCachedPromptPrefix(chars?: number): Promise<string | null>;
//# sourceMappingURL=opencode-codex.d.ts.map