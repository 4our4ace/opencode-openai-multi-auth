import { tool, type Plugin, type PluginInput } from "@opencode-ai/plugin";
import type { Auth } from "@opencode-ai/sdk";
import {
  createAuthorizationFlow,
  decodeJWT,
  extractAccountIdFromToken,
  exchangeAuthorizationCode,
  parseAuthorizationInput,
  REDIRECT_URI,
  validateAuthorizationState,
} from "./lib/auth/auth.js";
import { openBrowserUrl } from "./lib/auth/browser.js";
import { startLocalOAuthServer } from "./lib/auth/server.js";
import {
  AUTH_LABELS,
  DUMMY_API_KEY,
  ERROR_MESSAGES,
  LOG_STAGES,
  PROVIDER_ID,
  HTTP_STATUS,
} from "./lib/constants.js";
import { logRequest, logDebug } from "./lib/logger.js";
import {
  extractRequestUrl,
  handleErrorResponse,
  handleSuccessResponse,
} from "./lib/request/fetch-helpers.js";
import { AccountManager } from "./lib/accounts/index.js";
import type { ManagedAccount } from "./lib/accounts/index.js";
import { codexStatus } from "./lib/codex-status.js";
import { SessionBindingStore } from "./lib/session-bindings.js";

const FETCH_MIDDLEWARE = Symbol.for(
  "@4our4ace/opencode-openai-compact/fetch-middleware",
);
const ACTIVE_MARKER = Symbol.for(
  "@4our4ace/opencode-openai-multi-auth/active",
);
const ACTIVE_INSTANCES = Symbol.for(
  "@4our4ace/opencode-openai-multi-auth/active-instances",
);
const FETCH_MIDDLEWARE_VERSION = 1;
type FetchMiddleware = {
  version: number;
  middleware?: (next: typeof fetch) => typeof fetch;
  base?: typeof fetch;
  attach?: (middleware: (next: typeof fetch) => typeof fetch) => void;
};

function requestInitFor(input: Request | string | URL, init?: RequestInit): RequestInit | undefined {
  if (!(input instanceof Request)) return init;
  const source = input.clone();
  const requestInit: RequestInit & { duplex?: "half" } = {
    method: input.method,
    headers: new Headers(input.headers),
    body: source.body ?? undefined,
    cache: input.cache,
    credentials: input.credentials,
    integrity: input.integrity,
    keepalive: input.keepalive,
    mode: input.mode,
    redirect: input.redirect,
    referrer: input.referrer,
    referrerPolicy: input.referrerPolicy,
    signal: input.signal,
    ...init,
  };
  const duplex = (input as Request & { duplex?: "half" }).duplex;
  if (duplex && requestInit.body != null) requestInit.duplex = duplex;
  return requestInit;
}

async function requestBodyText(input: Request | string | URL, init?: RequestInit) {
  if (typeof init?.body === "string") return init.body;
  if (input instanceof Request) return input.clone().text();
  return undefined;
}

function extractModelFromBody(body: string | undefined): string | undefined {
  if (!body) return undefined;
  try {
    const parsed = JSON.parse(body);
    return parsed?.model;
  } catch {
    return undefined;
  }
}

function extractPromptCacheKeyFromBody(body: string | undefined): string | undefined {
  if (!body) return undefined;
  try {
    const parsed = JSON.parse(body);
    if (typeof parsed?.prompt_cache_key !== "string") {
      return undefined;
    }
    const key = parsed.prompt_cache_key.trim();
    return key.length > 0 ? key : undefined;
  } catch {
    return undefined;
  }
}

export const OpenAIAuthPlugin: Plugin = async ({ client }: PluginInput) => {
  const globals = globalThis as Record<PropertyKey, unknown>;
  const instance = Symbol("@4our4ace/opencode-openai-multi-auth/instance");
  const instances =
    globals[ACTIVE_INSTANCES] instanceof Set
      ? (globals[ACTIVE_INSTANCES] as Set<symbol>)
      : new Set<symbol>();
  instances.add(instance);
  globals[ACTIVE_INSTANCES] = instances;
  globals[ACTIVE_MARKER] = true;

  const quietMode = process.env.OPENCODE_OPENAI_QUIET === "1";
  const debugMode = process.env.OPENCODE_OPENAI_DEBUG === "1";
  const toastAccountBySession = new Map<string, number>();
  let baseFetch: typeof fetch = fetch;
  let compactMiddleware: ((next: typeof fetch) => typeof fetch) | undefined;
  let multiAuthFetch: typeof fetch = fetch;
  const multiAuthConsumer: typeof fetch = (input, init) =>
    multiAuthFetch(input, init);
  Object.defineProperty(multiAuthConsumer, FETCH_MIDDLEWARE, {
    value: {
      version: FETCH_MIDDLEWARE_VERSION,
      attach: (middleware) => {
        compactMiddleware = middleware;
      },
    } satisfies FetchMiddleware,
  });

  const showRateLimitToast = async (
    account: ManagedAccount,
    retryAfterMs: number,
  ) => {
    if (quietMode) return;
    const accountLabel = account.email || `Account ${account.index + 1}`;
    const retryMinutes = Math.ceil(retryAfterMs / 60000);
    const retryText =
      retryMinutes >= 60
        ? `${Math.ceil(retryMinutes / 60)}h`
        : `${retryMinutes}m`;
    try {
      await client.tui.showToast({
        body: {
          message: `${accountLabel} rate limited. Retry in ${retryText}.`,
          variant: "warning",
        },
      });
    } catch {}
  };

  const showAccountSwitchToast = async (
    fromAccount: ManagedAccount,
    toAccount: ManagedAccount,
  ) => {
    if (quietMode) return;
    const fromLabel = fromAccount.email || `Account ${fromAccount.index + 1}`;
    const toLabel = toAccount.email || `Account ${toAccount.index + 1}`;
    const toPlanLabel = toAccount.planType ? ` [${toAccount.planType}]` : "";
    try {
      await client.tui.showToast({
        body: {
          message: `Switching ${fromLabel} -> ${toLabel}${toPlanLabel}`,
          variant: "info",
        },
      });
    } catch {}
  };

  const showAccountToast = async (
    sessionKey: string | undefined,
    account: ManagedAccount,
    totalAccounts: number,
  ) => {
    if (quietMode) return;
    if (totalAccounts <= 1) return;

    const toastKey = sessionKey ?? "__fallback__";
    if (toastAccountBySession.get(toastKey) === account.index) {
      return;
    }

    toastAccountBySession.set(toastKey, account.index);

    const accountLabel = account.email || `Account ${account.index + 1}`;
    const planLabel = account.planType ? ` [${account.planType}]` : "";
    try {
      await client.tui.showToast({
        body: {
          message: `Using ${accountLabel}${planLabel} (${account.index + 1}/${totalAccounts})`,
          variant: "info",
        },
      });
    } catch {}
  };

  const showModelRetryToast = async (
    model: string,
    failedAccount: ManagedAccount,
    nextAccount: ManagedAccount,
    triedCount: number,
    totalAccounts: number,
  ) => {
    if (quietMode) return;
    const failedLabel = failedAccount.email || `Account ${failedAccount.index + 1}`;
    const nextLabel = nextAccount.email || `Account ${nextAccount.index + 1}`;
    const nextPlan = nextAccount.planType ? ` [${nextAccount.planType}]` : "";
    try {
      await client.tui.showToast({
        body: {
          message: `${model} not on ${failedLabel}, trying ${nextLabel}${nextPlan} (${triedCount}/${totalAccounts})`,
          variant: "info",
        },
      });
    } catch {}
  };

  const accountManager = new AccountManager({
    accountSelectionStrategy:
      (process.env.OPENCODE_OPENAI_STRATEGY as
        | "sticky"
        | "round-robin"
        | "hybrid") || "sticky",
    debug: process.env.OPENCODE_OPENAI_DEBUG === "1",
    quietMode: process.env.OPENCODE_OPENAI_QUIET === "1",
    pidOffsetEnabled: process.env.OPENCODE_OPENAI_PID_OFFSET === "1",
  });

  await accountManager.loadFromDisk();
  await accountManager.importFromOpenCodeAuth();

  const sessionBindingStore = new SessionBindingStore();
  sessionBindingStore.loadFromDisk();

  const findAccountByIndex = (index: number): ManagedAccount | null => {
    return accountManager.getAllAccounts().find((acc) => acc.index === index) || null;
  };

  const getSessionBoundAccount = async (
    sessionKey: string | undefined,
    model?: string,
  ): Promise<ManagedAccount | null> => {
    if (!sessionKey) {
      return accountManager.getNextAvailableAccount(model);
    }

    const boundIndex = sessionBindingStore.get(sessionKey);
    if (boundIndex !== undefined) {
      const bound = findAccountByIndex(boundIndex);
      if (bound) {
        return bound;
      }
      sessionBindingStore.delete(sessionKey);
    }

    const account = await accountManager.getNextAvailableAccountForNewSession(model);
    if (account) {
      sessionBindingStore.set(sessionKey, account.index);
    }
    return account;
  };

  const buildManualOAuthFlow = (
    pkce: { verifier: string },
    expectedState: string,
    url: string,
  ) => ({
    url,
    method: "code" as const,
    instructions: AUTH_LABELS.INSTRUCTIONS_MANUAL,
    callback: async (input: string) => {
      const parsed = parseAuthorizationInput(input);
      if (!parsed.code || !validateAuthorizationState(parsed.state, expectedState)) {
        return { type: "failed" as const };
      }
      const tokens = await exchangeAuthorizationCode(
        parsed.code,
        pkce.verifier,
        REDIRECT_URI,
      );

      if (tokens?.type === "success") {
        const decoded = decodeJWT(tokens.access);
        const profile = decoded?.["https://api.openai.com/profile"] as
          | Record<string, unknown>
          | undefined;
        const email = profile?.email as string | undefined;
        await accountManager.addAccount(
          email,
          tokens.refresh,
          tokens.access,
          tokens.expires,
        );
      }

      return tokens?.type === "success" ? tokens : { type: "failed" as const };
    },
  });

  const buildAutoOAuthFlow = (
    pkce: { verifier: string },
    state: string,
    url: string,
    serverInfo: {
      waitForCode: (s: string) => Promise<{ code: string } | null>;
      close: () => void;
    },
  ) => ({
    url,
    method: "auto" as const,
    instructions: AUTH_LABELS.INSTRUCTIONS,
    callback: async () => {
      const result = await serverInfo.waitForCode(state);
      serverInfo.close();

      if (!result) {
        return { type: "failed" as const };
      }

      const tokens = await exchangeAuthorizationCode(
        result.code,
        pkce.verifier,
        REDIRECT_URI,
      );

      if (tokens?.type === "success") {
        const decoded = decodeJWT(tokens.access);
        const profile = decoded?.["https://api.openai.com/profile"] as
          | Record<string, unknown>
          | undefined;
        const email = profile?.email as string | undefined;
        await accountManager.addAccount(
          email,
          tokens.refresh,
          tokens.access,
          tokens.expires,
        );
      }

      return tokens?.type === "success" ? tokens : { type: "failed" as const };
    },
  });

  return {
    auth: {
      provider: PROVIDER_ID,
      async loader(getAuth: () => Promise<Auth>, provider: unknown) {
        const auth = await getAuth();

        if (auth.type !== "oauth") {
          return {};
        }

        if (accountManager.getAccountCount() === 0) {
          const decoded = decodeJWT(auth.access);
          const profile = decoded?.["https://api.openai.com/profile"] as
            | Record<string, unknown>
            | undefined;
          const email = profile?.email as string | undefined;
          await accountManager.addAccount(
            email,
            auth.refresh,
            auth.access,
            auth.expires,
          );
        }

        const executeRequest = async (
          account: ManagedAccount,
          input: Request | string | URL,
          init: RequestInit | undefined,
          retryCount = 0,
          triedAccountIndices: Set<number> = new Set(),
        ): Promise<Response> => {
          // Track this account as tried
          triedAccountIndices.add(account.index);
          const isTokenValid = await accountManager.ensureValidToken(account);
          if (!isTokenValid) {
            const nextAccount = await accountManager.getNextAvailableAccountExcluding(triedAccountIndices);
            if (nextAccount && nextAccount.index !== account.index) {
              await showAccountSwitchToast(account, nextAccount);
              return executeRequest(nextAccount, input, init, retryCount, triedAccountIndices);
            }
            return new Response(
              JSON.stringify({
                error:
                  "Token refresh failed for the current session account. Start a new session to switch accounts.",
              }),
              {
                status: HTTP_STATUS.UNAUTHORIZED,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const originalUrl = extractRequestUrl(input);
          let parsedUrl: URL;
          try {
            parsedUrl = new URL(originalUrl);
          } catch {
            return new Response(JSON.stringify({ error: ERROR_MESSAGES.INVALID_BACKEND_URL }), {
              status: HTTP_STATUS.BAD_REQUEST,
              headers: { "Content-Type": "application/json" },
            });
          }

          const isOpenAISource =
            parsedUrl.protocol === "https:" &&
            parsedUrl.hostname === "api.openai.com" &&
            ["/v1/responses", "/v1/chat/completions", "/chat/completions"].includes(
              parsedUrl.pathname,
            );
          const isChatGPTCodexResponse =
            parsedUrl.protocol === "https:" &&
            parsedUrl.hostname === "chatgpt.com" &&
            ["/backend-api/codex/responses", "/backend-api/responses"].includes(
              parsedUrl.pathname,
            );
          if (!isOpenAISource && !isChatGPTCodexResponse) {
            return new Response(JSON.stringify({ error: ERROR_MESSAGES.INVALID_BACKEND_URL }), {
              status: HTTP_STATUS.BAD_REQUEST,
              headers: { "Content-Type": "application/json" },
            });
          }

          const url = isOpenAISource
            ? "https://chatgpt.com/backend-api/codex/responses"
            : originalUrl;
          const requestInit = requestInitFor(input, init);

          let originalBody: Record<string, unknown> = {};
          if (typeof requestInit?.body === "string") {
            try {
              originalBody = JSON.parse(requestInit.body);
            } catch {
              originalBody = {};
            }
          }
          const isStreaming = originalBody.stream === true;
          const model =
            typeof originalBody.model === "string"
              ? originalBody.model
              : undefined;
          const accountId =
            account.accountId || extractAccountIdFromToken(account.access || "");

          if (!accountId) {
            logDebug(
              `[openai-multi-auth] No account ID for account ${account.index}`,
            );
            return new Response(
              JSON.stringify({ error: ERROR_MESSAGES.NO_ACCOUNT_ID }),
              {
                status: HTTP_STATUS.UNAUTHORIZED,
                headers: { "Content-Type": "application/json" },
              },
            );
          }

          const headers = new Headers(requestInit?.headers ?? {});
          headers.set("Authorization", `Bearer ${account.access || ""}`);
          headers.set("ChatGPT-Account-Id", accountId);

          const response = await (compactMiddleware
            ? compactMiddleware(baseFetch)
            : baseFetch)(url, {
            ...requestInit,
            headers,
          });

          try {
            const headersObj: Record<string, string> = {};
            response.headers.forEach((value, key) => {
              headersObj[key] = value;
            });
            await codexStatus.updateFromHeaders(account, headersObj);
          } catch (error) {
            if (debugMode) {
              console.log("[openai-multi-auth] codex-status update failed", error);
            }
          }

          logRequest(LOG_STAGES.RESPONSE, {
            status: response.status,
            ok: response.ok,
            statusText: response.statusText,
            accountIndex: account.index,
            accountEmail: account.email,
          });

          if (response.status === HTTP_STATUS.TOO_MANY_REQUESTS) {
            const retryAfterHeader = response.headers.get("Retry-After");
            let retryAfterMs: number;

            if (retryAfterHeader) {
              retryAfterMs = parseInt(retryAfterHeader) * 1000;
            } else {
              try {
                const cloned = response.clone();
                const errorBody = (await cloned.json()) as any;
                const resetTime =
                  errorBody?.error?.details?.resets_at || errorBody?.resets_at;
                if (resetTime) {
                  retryAfterMs = new Date(resetTime).getTime() - Date.now();
                } else {
                  retryAfterMs = 60000;
                }
              } catch {
                retryAfterMs = 60000;
              }
            }

            accountManager.markRateLimited(account, retryAfterMs, model);
            await showRateLimitToast(account, retryAfterMs);

            if (debugMode) {
              const headersObj: Record<string, string> = {};
              response.headers.forEach((value, key) => {
                headersObj[key] = value;
              });
              try {
                const cloned = response.clone();
                const body = await cloned.json();
                console.log(
                  `[openai-multi-auth] Rate limit headers: ${JSON.stringify(headersObj)}, body: ${JSON.stringify(body)}, calculated: ${retryAfterMs}ms (${Math.ceil(Math.max(0, retryAfterMs) / 60000)}m)`,
                );
              } catch {}
            }
            if (retryCount < accountManager.getAccountCount() - 1) {
              const nextAccount =
                await accountManager.getNextAvailableAccountExcluding(triedAccountIndices, model);
              if (nextAccount && nextAccount.index !== account.index) {
                await showAccountSwitchToast(account, nextAccount);
            return executeRequest(nextAccount, input, init, retryCount + 1, triedAccountIndices);
              }
            }
          }

          if (response.status === HTTP_STATUS.UNAUTHORIZED) {
            accountManager.markRefreshFailed(account, "401 Unauthorized");
            const nextAccount =
              await accountManager.getNextAvailableAccountExcluding(triedAccountIndices, model);
            if (nextAccount && nextAccount.index !== account.index) {
              await showAccountSwitchToast(account, nextAccount);
              return executeRequest(nextAccount, input, init, retryCount + 1, triedAccountIndices);
            }
          }

          // Handle model not supported errors (400 Bad Request with specific message)
          if (response.status === 400) {
            try {
              const cloned = response.clone();
              const errorBody = await cloned.json() as { detail?: string; error?: { message?: string } };
              const detail = errorBody?.detail || errorBody?.error?.message || "";
              
              // Always log 400 errors to file for debugging
              const fs = await import("node:fs");
              const path = await import("node:path");
              const os = await import("node:os");
              const logDir = path.join(os.homedir(), ".opencode", "logs", "codex-plugin");
              fs.mkdirSync(logDir, { recursive: true });
              fs.writeFileSync(path.join(logDir, "last-400-error.json"), JSON.stringify({ 
                timestamp: new Date().toISOString(),
                model,
                status: response.status, 
                errorBody,
                detail,
                accountIndex: account.index,
                accountEmail: account.email,
                accountPlanType: account.planType,
                triedAccounts: Array.from(triedAccountIndices),
                totalAccounts: accountManager.getAccountCount(),
              }, null, 2));
              
              // Log the error for debugging
              if (debugMode) {
                console.log(`[openai-multi-auth] 400 error for model ${model} on account ${account.email || account.index} [${account.planType}]: ${JSON.stringify(errorBody)}`);
              }
              
              // Check if it's a "model not supported" error
              if (detail.includes("model is not supported") || detail.includes("not supported when using Codex")) {
                const requestedModel = typeof model === "string" ? model : "";
                if (!requestedModel) {
                  return await handleErrorResponse(response);
                }
                
                // STEP 1: Try other accounts first (they might be Plus/Pro/Team and support the model)
                const nextAccount = await accountManager.getNextAvailableAccountExcluding(triedAccountIndices, requestedModel);
                if (nextAccount) {
                  if (debugMode) {
                    console.log(`[openai-multi-auth] Model ${requestedModel} not supported on ${account.email || account.index} [${account.planType}], trying ${nextAccount.email || nextAccount.index} [${nextAccount.planType}]`);
                  }
                  await showModelRetryToast(
                    requestedModel,
                    account,
                    nextAccount,
                    triedAccountIndices.size,
                    accountManager.getAccountCount(),
                  );
                  return executeRequest(nextAccount, input, init, retryCount, triedAccountIndices);
                }
                
              }
            } catch {
              // If parsing fails, continue with normal error handling
            }
          }

          if (!response.ok) {
            return await handleErrorResponse(response);
          }

          return await handleSuccessResponse(response, isStreaming);
        };

        multiAuthFetch = async (
          input: Request | string | URL,
          init?: RequestInit,
        ): Promise<Response> => {
          const requestBody = await requestBodyText(input, init);
          const model = extractModelFromBody(requestBody);
          const sessionKey = extractPromptCacheKeyFromBody(requestBody);
          const account = await getSessionBoundAccount(sessionKey, model);

          if (!account) {
            return new Response(
              JSON.stringify({ error: "No available OpenAI accounts" }),
              { status: 503, headers: { "Content-Type": "application/json" } },
            );
          }

          await showAccountToast(sessionKey, account, accountManager.getAccountCount());
          return executeRequest(account, input, init);
        };
        return {
          apiKey: DUMMY_API_KEY,
          fetch: multiAuthConsumer,
        };
      },
      methods: [
        {
          label: AUTH_LABELS.OAUTH,
          type: "oauth" as const,
          authorize: async () => {
            const { pkce, state, url } = await createAuthorizationFlow();
            const serverInfo = await startLocalOAuthServer({ state });

            openBrowserUrl(url);

            if (!serverInfo.ready) {
              serverInfo.close();
              return buildManualOAuthFlow(pkce, state, url);
            }

            return buildAutoOAuthFlow(pkce, state, url, serverInfo);
          },
        },
        {
          label: "Add Another OpenAI Account",
          type: "oauth" as const,
          authorize: async () => {
            const { pkce, state, url } = await createAuthorizationFlow();
            const serverInfo = await startLocalOAuthServer({ state });

            openBrowserUrl(url);

            if (!serverInfo.ready) {
              serverInfo.close();
              return buildManualOAuthFlow(pkce, state, url);
            }

            return buildAutoOAuthFlow(pkce, state, url, serverInfo);
          },
        },
        {
          label: AUTH_LABELS.OAUTH_MANUAL,
          type: "oauth" as const,
          authorize: async () => {
            const { pkce, state, url } = await createAuthorizationFlow();
            return buildManualOAuthFlow(pkce, state, url);
          },
        },
        {
          label: AUTH_LABELS.API_KEY,
          type: "api" as const,
        },
      ],
    },
    config: async (cfg) => {
      const configuredFetch = (cfg.provider as Record<string, any> | undefined)
        ?.openai?.options?.fetch;
      const protocol = typeof configuredFetch === "function"
        ? (configuredFetch as unknown as Record<PropertyKey, unknown>)[
            FETCH_MIDDLEWARE
          ] as FetchMiddleware | undefined
        : undefined;
      if (protocol?.version === FETCH_MIDDLEWARE_VERSION && protocol.middleware) {
        baseFetch = protocol.base ?? fetch;
        compactMiddleware = protocol.middleware;
      } else if (typeof configuredFetch === "function") {
        baseFetch = configuredFetch;
      }
      const provider = ((cfg.provider ??= {}) as Record<string, any>).openai ??= {};
      const options = (provider.options ??= {}) as Record<string, any>;
      options.fetch = multiAuthConsumer;

      cfg.command = cfg.command || {};
      cfg.command["codex-status"] = {
        template:
          "Run the codex-status tool and output the result EXACTLY as returned by the tool, without any additional text or commentary.",
        description: "List all configured OpenAI accounts and their current usage status.",
      };

      cfg.experimental = cfg.experimental || {};
      cfg.experimental.primary_tools = cfg.experimental.primary_tools || [];
      if (!cfg.experimental.primary_tools.includes("codex-status")) {
        cfg.experimental.primary_tools.push("codex-status");
      }
    },
    tool: {
      "codex-status": tool({
        description: "List all configured OpenAI accounts and their current usage status.",
        args: {},
        async execute() {
          const accounts = accountManager.getAllAccounts();
          if (accounts.length === 0) {
            return [
              "OpenAI Codex Status",
              "",
              "  Accounts: 0",
              "",
              "Add accounts:",
              "  opencode auth login",
            ].join("\n");
          }

          const now = Date.now();
          await Promise.all(
            accounts.map(async (acc) => {
              if (acc.access && acc.expires && acc.expires > now) {
                await codexStatus.fetchFromBackend(acc, acc.access);
              }
            }),
          );

          const active = accountManager.getActiveAccount();
          const activeIndex = active?.index ?? 0;
          const lines: string[] = ["OpenAI Codex Status", ""];

          for (const account of accounts) {
            const status = account.index === activeIndex ? "ACTIVE" : "READY";
            const email = account.email || `Account ${account.index + 1}`;
            const plan = account.planType || "Unknown";
            lines.push(`${account.index + 1}. ${status} ${email} [${plan}]`);
            const statusLines = await codexStatus.renderStatus(account);
            for (const line of statusLines) {
              lines.push(line);
            }
            lines.push("");
          }

          return lines.join("\n");
        },
      }),
    },
    dispose: async () => {
      const currentInstances = globals[ACTIVE_INSTANCES];
      if (!(currentInstances instanceof Set)) return;

      currentInstances.delete(instance);
      if (currentInstances.size === 0) {
        if (globals[ACTIVE_MARKER] === true) {
          delete globals[ACTIVE_MARKER];
        }
        if (globals[ACTIVE_INSTANCES] === currentInstances) {
          delete globals[ACTIVE_INSTANCES];
        }
      }
    },
  } as Awaited<ReturnType<Plugin>>;
};

export default OpenAIAuthPlugin;
