export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: any;
  properties?: Record<string, ToolParameter>;
  required?: string[];
}

export interface InternalToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter;
}

export interface ToolResult {
  toolCallId: string;
  result: string;
  error?: string;
}

export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: ToolParameter;
  
  abstract execute(params: Record<string, any>): Promise<string>;
  
  getDefinition(): InternalToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: this.parameters,
    };
  }
  
  protected validateParams(params: Record<string, any>): void {
    const required = this.parameters.required || [];
    for (const field of required) {
      if (params[field] === undefined) {
        throw new Error(`Missing required parameter: ${field}`);
      }
    }
  }
}
