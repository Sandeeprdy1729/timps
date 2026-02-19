export interface CLIOptions {
    userId: number;
    username?: string;
    systemPrompt?: string;
    interactive?: boolean;
    memoryMode?: 'persistent' | 'ephemeral';
}
export declare function runCLI(options: CLIOptions): Promise<void>;
export declare function printHelp(): void;
//# sourceMappingURL=cli.d.ts.map