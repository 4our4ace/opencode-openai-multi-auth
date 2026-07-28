import type { ConfigOptions, InputItem, ReasoningConfig, RequestBody, UserConfig } from "../types.js";
export { isOpenCodeSystemPrompt, filterOpenCodeSystemPromptsWithCachedPrompt, } from "./helpers/input-utils.js";
/**
 * Normalize model name to Codex-supported variants
 *
 * Uses explicit model map for known models, with fallback pattern matching
 * for unknown/custom model names.
 *
 * @param model - Original model name (e.g., "gpt-5.1-codex-low", "openai/gpt-5-codex")
 * @returns Normalized model name (e.g., "gpt-5.1-codex", "gpt-5-codex")
 */
export declare function normalizeModel(model: string | undefined): string;
/**
 * Extract configuration for a specific model
 * Merges global options with model-specific options (model-specific takes precedence)
 * @param modelName - Model name (e.g., "gpt-5-codex")
 * @param userConfig - Full user configuration object
 * @returns Merged configuration for this model
 */
export declare function getModelConfig(modelName: string, userConfig?: UserConfig): ConfigOptions;
/**
 * Configure reasoning parameters based on model variant and user config
 *
 * NOTE: This plugin follows Codex CLI defaults instead of opencode defaults because:
 * - We're accessing the ChatGPT backend API (not OpenAI Platform API)
 * - opencode explicitly excludes gpt-5-codex from automatic reasoning configuration
 * - Codex CLI has been thoroughly tested against this backend
 *
 * @param originalModel - Original model name before normalization
 * @param userConfig - User configuration object
 * @returns Reasoning configuration
 */
export declare function getReasoningConfig(modelName: string | undefined, userConfig?: ConfigOptions): ReasoningConfig;
/**
 * Filter input array for stateless Codex API (store: false)
 *
 * Two transformations needed:
 * 1. Remove AI SDK-specific items (not supported by Codex API)
 * 2. Strip IDs from all remaining items (stateless mode)
 *
 * AI SDK constructs to REMOVE (not in OpenAI Responses API spec):
 * - type: "item_reference" - AI SDK uses this for server-side state lookup
 *
 * Items to KEEP (strip IDs):
 * - type: "message" - Conversation messages (provides context to LLM)
 * - type: "function_call" - Tool calls from conversation
 * - type: "function_call_output" - Tool results from conversation
 *
 * Context is maintained through:
 * - Full message history (without IDs)
 * - reasoning.encrypted_content (for reasoning continuity)
 *
 * @param input - Original input array from OpenCode/AI SDK
 * @returns Filtered input array compatible with Codex API
 */
export declare function filterInput(input: InputItem[] | undefined): InputItem[] | undefined;
/**
 * Filter out OpenCode system prompts from input
 * Used in CODEX_MODE to replace OpenCode prompts with Codex-OpenCode bridge
 * @param input - Input array
 * @returns Input array without OpenCode system prompts
 */
export declare function filterOpenCodeSystemPrompts(input: InputItem[] | undefined): Promise<InputItem[] | undefined>;
/**
 * Add Codex-OpenCode bridge message to input if tools are present
 * @param input - Input array
 * @param hasTools - Whether tools are present in request
 * @returns Input array with bridge message prepended if needed
 */
export declare function addCodexBridgeMessage(input: InputItem[] | undefined, hasTools: boolean): InputItem[] | undefined;
/**
 * Add tool remapping message to input if tools are present
 * @param input - Input array
 * @param hasTools - Whether tools are present in request
 * @returns Input array with tool remap message prepended if needed
 */
export declare function addToolRemapMessage(input: InputItem[] | undefined, hasTools: boolean): InputItem[] | undefined;
/**
 * Transform request body for Codex API
 *
 * NOTE: Configuration follows Codex CLI patterns instead of opencode defaults:
 * - opencode sets textVerbosity="low" for gpt-5, but Codex CLI uses "medium"
 * - opencode excludes gpt-5-codex from reasoning configuration
 * - This plugin uses store=false (stateless), requiring encrypted reasoning content
 *
 * @param body - Original request body
 * @param userConfig - User configuration from loader
 * @param codexMode - Enable CODEX_MODE (bridge prompt instead of tool remap) - defaults to true
 * @returns Transformed request body
 */
export declare function transformRequestBody(body: RequestBody, userConfig?: UserConfig, codexMode?: boolean): Promise<RequestBody>;
//# sourceMappingURL=request-transformer.d.ts.map