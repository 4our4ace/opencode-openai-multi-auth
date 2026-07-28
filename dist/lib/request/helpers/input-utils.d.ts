import type { InputItem } from "../../types.js";
export declare const getContentText: (item: InputItem) => string;
export declare function isOpenCodeSystemPrompt(item: InputItem, cachedPrompt: string | null): boolean;
export declare function filterOpenCodeSystemPromptsWithCachedPrompt(input: InputItem[] | undefined, cachedPrompt: string | null): InputItem[] | undefined;
export declare const normalizeOrphanedToolOutputs: (input: InputItem[]) => InputItem[];
//# sourceMappingURL=input-utils.d.ts.map