export interface ProviderAuthResolverInput {
    providerID: string;
    sessionID?: string;
}
export interface ProviderAuthCredentials {
    access: string;
    accountId?: string;
    expires?: number;
}
export type ProviderAuthResolver = (input: ProviderAuthResolverInput) => Promise<ProviderAuthCredentials | undefined>;
export interface ProviderAuthResolverRegistry {
    version: 1;
    resolvers: Map<string, Set<ProviderAuthResolver>>;
}
export declare const PROVIDER_AUTH_RESOLVERS_SYMBOL: unique symbol;
export declare function registerProviderAuthResolver(providerID: string, resolver: ProviderAuthResolver): () => void;
//# sourceMappingURL=provider-auth-resolvers.d.ts.map