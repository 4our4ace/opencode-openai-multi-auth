import { describe, it, expect, vi, beforeEach } from 'vitest';

const transformRequestForCodexMock = vi.fn();
const showToastMock = vi.fn();
let fallbackAccountIndex = 0;
const accounts = [
	{
		index: 0,
		email: 'first@example.com',
		access: 'first-access-token',
		expires: Date.now() + 60_000,
		accountId: 'acct_first',
	},
	{
		index: 1,
		email: 'second@example.com',
		access: 'second-access-token',
		expires: Date.now() + 60_000,
		accountId: 'acct_second',
	},
];

vi.mock('@opencode-ai/plugin', () => ({
	tool: Object.assign((definition: unknown) => definition, {
		schema: { coerce: { number: () => ({ int: () => ({ nonnegative: () => ({}) }) }) } },
	}),
}));

vi.mock('../lib/request/fetch-helpers.js', async () => {
	const actual = await vi.importActual<typeof import('../lib/request/fetch-helpers.js')>(
		'../lib/request/fetch-helpers.js',
	);
	return {
		...actual,
		transformRequestForCodex: transformRequestForCodexMock,
	};
});

vi.mock('../lib/accounts/index.js', () => {
	class AccountManager {
		async loadFromDisk() {}
		async importFromOpenCodeAuth() {}
		getAllAccounts() {
			return accounts;
		}
		getAccountCount() {
			return accounts.length;
		}
		getActiveAccount() {
			return accounts[0];
		}
		async setActiveAccount(index: number) {
			return accounts[index] ?? null;
		}
		async getNextAvailableAccount() {
			return accounts[fallbackAccountIndex];
		}
		async getNextAvailableAccountForNewSession() {
			return accounts[0];
		}
		async getNextAvailableAccountExcluding(excluded: Set<number>) {
			return accounts.find((account) => !excluded.has(account.index)) ?? null;
		}
		async ensureValidToken() {
			return true;
		}
		markRateLimited() {}
		markRefreshFailed() {}
		async addAccount() {}
	}

	return { AccountManager };
});

vi.mock('../lib/session-bindings.js', () => {
	class SessionBindingStore {
		private map = new Map<string, number>();
		loadFromDisk() {}
		get(key: string) {
			return this.map.get(key);
		}
		set(key: string, value: number) {
			this.map.set(key, value);
		}
		delete(key: string) {
			this.map.delete(key);
		}
	}

	return { SessionBindingStore };
});

describe('Runtime fetch parity', () => {
	beforeEach(() => {
		transformRequestForCodexMock.mockReset();
		showToastMock.mockReset();
		fallbackAccountIndex = 0;
		(globalThis as any).fetch = vi.fn(async () => {
			return new Response('data: {"type":"response.done"}\n\n', {
				status: 200,
				headers: { 'content-type': 'text/event-stream' },
			});
		});
	});

	async function loadFetch() {
		const plugin = await loadPlugin();
		const loader = await plugin.auth.loader(
			async () => ({
				type: 'oauth',
				access: 'access-token',
				refresh: 'refresh-token',
				expires: Date.now() + 60_000,
			}) as any,
			{} as any,
		);
		return loader.fetch;
	}

	async function loadPlugin() {
		const { OpenAIAuthPlugin } = await import('../index.js');
		return OpenAIAuthPlugin({
			client: {
				auth: { set: vi.fn() },
				tui: { showToast: showToastMock },
			},
		} as any);
	}

	it('shows the account usage toast once per session account', async () => {
		const fetch = await loadFetch();
		const request = (promptCacheKey?: string) =>
			fetch('https://api.openai.com/v1/responses', {
				method: 'POST',
				body: JSON.stringify({ model: 'gpt-5.3-codex', prompt_cache_key: promptCacheKey }),
			});

		await request('session-one');
		await request('session-one');
		fallbackAccountIndex = 1;
		await request();

		expect(showToastMock).toHaveBeenCalledTimes(2);
		expect(showToastMock.mock.calls.map(([call]) => call.body.message)).toEqual([
			'Using first@example.com (1/2)',
			'Using second@example.com (2/2)',
		]);
	});

	it('switches the current session to a selected account', async () => {
		const plugin = await loadPlugin();
		const result = await plugin.tool['switch-account'].execute(
			{ accountIndex: 1 },
			{ sessionID: 'manual-switch-session' },
		);

		expect(result).toBe('Switched to second@example.com.');
	});

	it('preserves the native request body and headers while replacing account auth', async () => {
		const fetch = await loadFetch();
		const body = {
			model: 'gpt-5.3-codex',
			prompt_cache_key: 'ses_test_key',
			input: [{ type: 'message', role: 'user', content: 'hello' }],
		};

		await fetch('https://api.openai.com/v1/responses', {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				'OpenAI-Beta': 'native-value',
				'x-api-key': 'native-api-key',
				'x-native-header': 'preserved',
				Authorization: 'Bearer native-token',
			},
			body: JSON.stringify(body),
		});

		const request = (globalThis as any).fetch.mock.calls[0];
		expect(request[0]).toBe('https://chatgpt.com/backend-api/codex/responses');
		expect(JSON.parse(request[1].body)).toEqual(body);
		expect(request[1].headers.get('OpenAI-Beta')).toBe('native-value');
		expect(request[1].headers.get('x-api-key')).toBe('native-api-key');
		expect(request[1].headers.get('x-native-header')).toBe('preserved');
		expect(request[1].headers.get('Authorization')).toBe('Bearer first-access-token');
		expect(request[1].headers.get('ChatGPT-Account-Id')).toBe('acct_first');
	});

	it('retries a rate-limited request with the next account unchanged', async () => {
		const responses = [
			new Response(JSON.stringify({ error: 'rate limited' }), {
				status: 429,
				headers: { 'Retry-After': '0' },
			}),
			new Response('data: {"type":"response.done"}\n\n', {
				status: 200,
				headers: { 'content-type': 'text/event-stream' },
			}),
		];
		(globalThis as any).fetch = vi.fn(async () => responses.shift());
		const fetch = await loadFetch();
		const body = JSON.stringify({ model: 'gpt-5.3-codex', input: [] });

		await fetch('https://api.openai.com/chat/completions', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body,
		});

		expect((globalThis as any).fetch).toHaveBeenCalledTimes(2);
		expect((globalThis as any).fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer first-access-token');
		expect((globalThis as any).fetch.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer second-access-token');
		expect((globalThis as any).fetch.mock.calls[1][1].headers.get('ChatGPT-Account-Id')).toBe('acct_second');
		expect((globalThis as any).fetch.mock.calls[1][1].body).toBe(body);
	});

	it('does not call transformRequestForCodex in runtime fetch path', async () => {
		const fetch = await loadFetch();

		await fetch('https://chatgpt.com/backend-api/responses', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				model: 'gpt-5.3-codex',
				prompt_cache_key: 'ses_test_key',
				input: [{ type: 'message', role: 'user', content: 'hello' }],
			}),
		});

		expect(transformRequestForCodexMock).not.toHaveBeenCalled();
		expect((globalThis as any).fetch).toHaveBeenCalled();
		expect((globalThis as any).fetch.mock.calls[0][0]).toBe('https://chatgpt.com/backend-api/responses');
	});

	it('composes compact before auth regardless of config hook order', async () => {
		const plugin = await loadPlugin();
		const fetchMiddleware = vi.fn((next: typeof fetch) =>
			(input: RequestInfo | URL, init?: RequestInit) => {
				expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer first-access-token');
				return next(input, init);
			},
		);
		const compactFetch = vi.fn();
		Object.defineProperty(compactFetch, Symbol.for('@4our4ace/opencode-openai-compact/fetch-middleware'), {
			value: { version: 1, base: globalThis.fetch, middleware: fetchMiddleware },
		});
		const cfg: any = { provider: { openai: { options: { fetch: compactFetch } } } };
		await plugin.config(cfg);
		const loader = await plugin.auth.loader(async () => ({
			type: 'oauth', access: 'access-token', refresh: 'refresh-token', expires: Date.now() + 60_000,
		}) as any, {} as any);
		await cfg.provider.openai.options.fetch('https://api.openai.com/v1/responses', {
			method: 'POST', body: JSON.stringify({ model: 'gpt-5.3-codex' }),
		});
		expect(fetchMiddleware).toHaveBeenCalled();
		expect((globalThis as any).fetch.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer first-access-token');
	});

	it('rejects unknown URLs before adding OAuth headers', async () => {
		const fetch = await loadFetch();
		const response = await fetch('https://example.com/secret', { headers: { 'x-test': 'yes' } });
		expect(response.status).toBe(400);
		expect((globalThis as any).fetch).not.toHaveBeenCalled();
	});

	it('preserves Request method, body, and headers', async () => {
		const fetch = await loadFetch();
		const request = new Request('https://api.openai.com/v1/responses', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'x-request': 'kept' },
			body: JSON.stringify({ model: 'gpt-5.3-codex', input: [] }),
		});
		await fetch(request);
		const [, init] = (globalThis as any).fetch.mock.calls[0];
		expect(init.method).toBe('POST');
		expect(init.headers.get('x-request')).toBe('kept');
		expect(JSON.parse(await new Response(init.body).text())).toEqual({ model: 'gpt-5.3-codex', input: [] });
	});
});
