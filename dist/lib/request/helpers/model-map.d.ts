/**
 * Model Configuration Map
 *
 * Maps model config IDs to their normalized API model names.
 * Only includes exact config IDs that OpenCode will pass to the plugin.
 */
/**
 * Map of config model IDs to normalized API model names
 *
 * Key: The model ID as specified in opencode.json config
 * Value: The normalized model name to send to the API
 */
export declare const MODEL_MAP: Record<string, string>;
/**
 * Get normalized model name from config ID
 *
 * @param modelId - Model ID from config (e.g., "gpt-5.1-codex-low")
 * @returns Normalized model name (e.g., "gpt-5.1-codex") or undefined if not found
 */
export declare function getNormalizedModel(modelId: string): string | undefined;
/**
 * Check if a model ID is in the model map
 *
 * @param modelId - Model ID to check
 * @returns True if model is in the map
 */
export declare function isKnownModel(modelId: string): boolean;
//# sourceMappingURL=model-map.d.ts.map