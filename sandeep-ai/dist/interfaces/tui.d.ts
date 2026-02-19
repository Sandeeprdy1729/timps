export interface TUIOptions {
    userId: number;
    username?: string;
    systemPrompt?: string;
    memoryMode?: 'persistent' | 'ephemeral';
    modelProvider?: string;
}
export declare function runTUI(options: TUIOptions): Promise<void>;
//# sourceMappingURL=tui.d.ts.map