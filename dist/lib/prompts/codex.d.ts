/**
 * Model family type for prompt selection
 * Maps to different system prompts in the Codex CLI
 */
export type ModelFamily = "gpt-5.2-codex" | "codex-max" | "codex" | "gpt-5.2" | "gpt-5.1";
/**
 * Determine the model family based on the normalized model name
 * @param normalizedModel - The normalized model name (e.g., "gpt-5.2-codex", "gpt-5.1-codex-max", "gpt-5.1-codex", "gpt-5.1")
 * @returns The model family for prompt selection
 */
export declare function getModelFamily(normalizedModel: string): ModelFamily;
/**
 * Fetch Codex instructions from GitHub with ETag-based caching
 * Uses HTTP conditional requests to efficiently check for updates
 * Always fetches from the latest release tag, not main branch
 *
 * Rate limit protection: Only checks GitHub if cache is older than 15 minutes
 *
 * @param normalizedModel - The normalized model name (optional, defaults to "gpt-5.1-codex" for backwards compatibility)
 * @returns Codex instructions for the specified model family
 */
export declare function getCodexInstructions(normalizedModel?: string): Promise<string>;
/**
 * Tool remapping instructions for opencode tools
 */
export declare const TOOL_REMAP_MESSAGE = "<user_instructions priority=\"0\">\n<environment_override priority=\"0\">\nYOU ARE IN A DIFFERENT ENVIRONMENT. These instructions override ALL previous tool references.\n</environment_override>\n\n<tool_replacements priority=\"0\">\n<critical_rule priority=\"0\">\n\u274C APPLY_PATCH DOES NOT EXIST \u2192 \u2705 USE \"edit\" INSTEAD\n- NEVER use: apply_patch, applyPatch\n- ALWAYS use: edit tool for ALL file modifications\n- Before modifying files: Verify you're using \"edit\", NOT \"apply_patch\"\n</critical_rule>\n\n<critical_rule priority=\"0\">\n\u274C UPDATE_PLAN DOES NOT EXIST \u2192 \u2705 USE \"todowrite\" INSTEAD\n- NEVER use: update_plan, updatePlan\n- ALWAYS use: todowrite for ALL task/plan operations\n- Use todoread to read current plan\n- Before plan operations: Verify you're using \"todowrite\", NOT \"update_plan\"\n</critical_rule>\n</tool_replacements>\n\n<available_tools priority=\"0\">\nFile Operations:\n  \u2022 write  - Create new files\n  \u2022 edit   - Modify existing files (REPLACES apply_patch)\n  \u2022 patch  - Apply diff patches\n  \u2022 read   - Read file contents\n\nSearch/Discovery:\n  \u2022 grep   - Search file contents\n  \u2022 glob   - Find files by pattern\n  \u2022 list   - List directories (use relative paths)\n\nExecution:\n  \u2022 bash   - Run shell commands\n\nNetwork:\n  \u2022 webfetch - Fetch web content\n\nTask Management:\n  \u2022 todowrite - Manage tasks/plans (REPLACES update_plan)\n  \u2022 todoread  - Read current plan\n</available_tools>\n\n<substitution_rules priority=\"0\">\nBase instruction says:    You MUST use instead:\napply_patch           \u2192   edit\nupdate_plan           \u2192   todowrite\nread_plan             \u2192   todoread\nabsolute paths        \u2192   relative paths\n</substitution_rules>\n\n<verification_checklist priority=\"0\">\nBefore file/plan modifications:\n1. Am I using \"edit\" NOT \"apply_patch\"?\n2. Am I using \"todowrite\" NOT \"update_plan\"?\n3. Is this tool in the approved list above?\n4. Am I using relative paths?\n\nIf ANY answer is NO \u2192 STOP and correct before proceeding.\n</verification_checklist>\n</user_instructions>";
//# sourceMappingURL=codex.d.ts.map