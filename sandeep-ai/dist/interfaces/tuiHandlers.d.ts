import { Memory } from '../memory/longTerm';
/**
 * Handle !blame command: search for memories by keyword
 */
export declare function handleBlame(userId: number, projectId: string, keyword: string): Promise<Memory[]>;
/**
 * Handle !forget command: delete memories matching keyword
 */
export declare function handleForget(userId: number, projectId: string, keyword: string): Promise<number[]>;
/**
 * Handle !audit command: show recent memories
 */
export declare function handleAudit(userId: number, projectId: string): Promise<Memory[]>;
//# sourceMappingURL=tuiHandlers.d.ts.map