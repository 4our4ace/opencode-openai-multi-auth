/**
 * Constants used throughout the plugin
 * Centralized for easy maintenance and configuration
 */
/** Plugin identifier for logging and error messages */
export declare const PLUGIN_NAME = "openai-codex-plugin";
/** Plugin version - used for client_version query parameter */
export declare const PLUGIN_VERSION = "0.98.0";
/** Base URL for ChatGPT backend API */
export declare const CODEX_BASE_URL = "https://chatgpt.com/backend-api";
/** Dummy API key used for OpenAI SDK (actual auth via OAuth) */
export declare const DUMMY_API_KEY = "chatgpt-oauth";
/** Provider ID for opencode configuration */
export declare const PROVIDER_ID = "openai";
/** HTTP Status Codes */
export declare const HTTP_STATUS: {
    readonly BAD_REQUEST: 400;
    readonly OK: 200;
    readonly UNAUTHORIZED: 401;
    readonly NOT_FOUND: 404;
    readonly TOO_MANY_REQUESTS: 429;
};
/** OpenAI-specific headers */
export declare const OPENAI_HEADERS: {
    readonly BETA: "OpenAI-Beta";
    readonly ACCOUNT_ID: "chatgpt-account-id";
    readonly ORIGINATOR: "originator";
    readonly SESSION_ID: "session_id";
    readonly CONVERSATION_ID: "conversation_id";
    readonly VERSION: "version";
};
/** OpenAI-specific header values */
export declare const OPENAI_HEADER_VALUES: {
    readonly BETA_RESPONSES: "responses=experimental";
    readonly ORIGINATOR_CODEX: "opencode";
};
/** Codex CLI originator value */
export declare const CODEX_ORIGINATOR = "codex_cli_rs";
/** URL path segments */
export declare const URL_PATHS: {
    readonly RESPONSES: "/responses";
    readonly CODEX_RESPONSES: "/codex/responses";
    readonly CODEX_MODELS: "/codex/models";
};
/** Model fallback map - when a model isn't available, fall back to this */
export declare const MODEL_FALLBACKS: Record<string, string>;
/** JWT claim path for ChatGPT account ID */
export declare const JWT_CLAIM_PATH: "https://api.openai.com/auth";
/** Error messages */
export declare const ERROR_MESSAGES: {
    readonly NO_ACCOUNT_ID: "Failed to extract accountId from token";
    readonly TOKEN_REFRESH_FAILED: "Failed to refresh token, authentication required";
    readonly REQUEST_PARSE_ERROR: "Error parsing request";
    readonly INVALID_BACKEND_URL: "Blocked request to untrusted backend URL";
};
/** Log stages for request logging */
export declare const LOG_STAGES: {
    readonly BEFORE_TRANSFORM: "before-transform";
    readonly AFTER_TRANSFORM: "after-transform";
    readonly RESPONSE: "response";
    readonly ERROR_RESPONSE: "error-response";
};
/** Platform-specific browser opener commands */
export declare const PLATFORM_OPENERS: {
    readonly darwin: "open";
    readonly win32: "start";
    readonly linux: "xdg-open";
};
/** OAuth authorization labels */
export declare const AUTH_LABELS: {
    readonly OAUTH: "ChatGPT Plus/Pro (Codex Subscription)";
    readonly OAUTH_MANUAL: "ChatGPT Plus/Pro (Manual URL Paste)";
    readonly API_KEY: "Manually enter API Key";
    readonly INSTRUCTIONS: "A browser window should open. If it doesn't, copy the URL and open it manually.";
    readonly INSTRUCTIONS_MANUAL: "After logging in, copy the full redirect URL and paste it here.";
};
//# sourceMappingURL=constants.d.ts.map