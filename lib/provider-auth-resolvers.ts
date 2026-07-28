export interface ProviderAuthResolverInput {
  providerID: string;
  sessionID?: string;
}

export interface ProviderAuthCredentials {
  access: string;
  accountId?: string;
  expires?: number;
}

export type ProviderAuthResolver = (
  input: ProviderAuthResolverInput,
) => Promise<ProviderAuthCredentials | undefined>;

export interface ProviderAuthResolverRegistry {
  version: 1;
  resolvers: Map<string, Set<ProviderAuthResolver>>;
}

export const PROVIDER_AUTH_RESOLVERS_SYMBOL = Symbol.for(
  "opencode.provider-auth-resolvers.v1",
);

function getRegistry(): ProviderAuthResolverRegistry {
  const globals = globalThis as Record<PropertyKey, unknown>;
  const current = globals[PROVIDER_AUTH_RESOLVERS_SYMBOL];

  if (
    typeof current === "object" &&
    current !== null &&
    (current as { version?: unknown }).version === 1 &&
    (current as { resolvers?: unknown }).resolvers instanceof Map
  ) {
    return current as ProviderAuthResolverRegistry;
  }

  const registry: ProviderAuthResolverRegistry = {
    version: 1,
    resolvers: new Map(),
  };
  globals[PROVIDER_AUTH_RESOLVERS_SYMBOL] = registry;
  return registry;
}

export function registerProviderAuthResolver(
  providerID: string,
  resolver: ProviderAuthResolver,
): () => void {
  const registry = getRegistry();
  let resolvers = registry.resolvers.get(providerID);
  if (!resolvers) {
    resolvers = new Set();
    registry.resolvers.set(providerID, resolvers);
  }
  resolvers.add(resolver);

  return () => {
    resolvers.delete(resolver);
    if (resolvers.size === 0) registry.resolvers.delete(providerID);
  };
}
