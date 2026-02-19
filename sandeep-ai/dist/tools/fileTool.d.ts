import { BaseTool, ToolParameter } from './baseTool';
export declare class FileTool extends BaseTool {
    name: string;
    description: string;
    parameters: ToolParameter;
    execute(params: Record<string, any>): Promise<string>;
    private readFile;
    private writeFile;
    private appendFile;
    private listDirectory;
    private checkExists;
    private makeDirectory;
    private deleteFile;
}
//# sourceMappingURL=fileTool.d.ts.map