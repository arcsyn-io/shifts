export interface McpTool {
  readonly name: string;
  readonly description: string;
  call(): unknown;
}
