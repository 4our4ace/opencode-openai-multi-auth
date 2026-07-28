/**
 * Codex Models API
 * Fetches available models from the ChatGPT backend
 * This call may be necessary to "unlock" access to certain models like gpt-5.3-codex
 */
/** Model info returned from the /models endpoint */
export interface ModelInfo {
    slug: string;
    display_name: string;
    description?: string;
    default_reasoning_level?: string;
    supported_reasoning_levels?: string[];
    visibility?: string;
    supported_in_api?: boolean;
}
/**
 * Fetch available models from the Codex backend
 * This call may help "register" the client and enable access to newer models
 *
 * @param accessToken - OAuth access token
 * @param accountId - ChatGPT account ID
 * @returns List of available models
 */
export declare function fetchAvailableModels(accessToken: string, accountId: string): Promise<ModelInfo[]>;
/**
 * Check if a specific model is available for an account
 *
 * @param modelSlug - Model slug to check (e.g., "gpt-5.3-codex")
 * @param accessToken - OAuth access token
 * @param accountId - ChatGPT account ID
 * @returns True if model is available
 */
export declare function isModelAvailable(modelSlug: string, accessToken: string, accountId: string): Promise<boolean>;
/**
 * Pre-fetch models to potentially "unlock" access to newer models
 * Call this before making requests to ensure the backend knows about our client
 *
 * @param accessToken - OAuth access token
 * @param accountId - ChatGPT account ID
 */
export declare function prefetchModels(accessToken: string, accountId: string): Promise<void>;
//# sourceMappingURL=models.d.ts.map