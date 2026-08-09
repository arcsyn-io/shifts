export interface McpToolErrorOutcome {
  content: Array<{ type: 'text'; text: string }>;
  isError: true;
}

export interface McpErrorHandler {
  canHandle(error: unknown): boolean;
  handle(error: unknown): McpToolErrorOutcome;
}

export const MCP_ERROR_HANDLERS = Symbol('MCP_ERROR_HANDLERS');

export function genericMcpToolError(): McpToolErrorOutcome {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          code: 'MCP_TOOL_ERROR',
          message: 'Não foi possível concluir a operação.',
        }),
      },
    ],
    isError: true,
  };
}
