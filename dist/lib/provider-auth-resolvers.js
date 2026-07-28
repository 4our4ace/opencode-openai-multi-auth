export const PROVIDER_AUTH_RESOLVERS_SYMBOL = Symbol.for("opencode.provider-auth-resolvers.v1");
function getRegistry() {
    const globals = globalThis;
    const current = globals[PROVIDER_AUTH_RESOLVERS_SYMBOL];
    if (typeof current === "object" &&
        current !== null &&
        current.version === 1 &&
        current.resolvers instanceof Map) {
        return current;
    }
    const registry = {
        version: 1,
        resolvers: new Map(),
    };
    globals[PROVIDER_AUTH_RESOLVERS_SYMBOL] = registry;
    return registry;
}
export function registerProviderAuthResolver(providerID, resolver) {
    const registry = getRegistry();
    let resolvers = registry.resolvers.get(providerID);
    if (!resolvers) {
        resolvers = new Set();
        registry.resolvers.set(providerID, resolvers);
    }
    resolvers.add(resolver);
    return () => {
        resolvers.delete(resolver);
        if (resolvers.size === 0)
            registry.resolvers.delete(providerID);
    };
}
//# sourceMappingURL=provider-auth-resolvers.js.map