import type { PluginConfig } from "./types.js";
/**
 * Load plugin configuration from ~/.opencode/openai-codex-auth-config.json
 * Falls back to defaults if file doesn't exist or is invalid
 *
 * @returns Plugin configuration
 */
export declare function loadPluginConfig(): PluginConfig;
/**
 * Get the effective CODEX_MODE setting
 * Priority: environment variable > config file > default (true)
 *
 * @param pluginConfig - Plugin configuration from file
 * @returns True if CODEX_MODE should be enabled
 */
export declare function getCodexMode(pluginConfig: PluginConfig): boolean;
//# sourceMappingURL=config.d.ts.map