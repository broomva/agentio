/**
 * @agentio/driver-mcp — MCP driver
 *
 * Model Context Protocol transport and tool discovery.
 * Connects to MCP servers, discovers tools, and routes invocations.
 */

import type { ToolContract } from "@agentio/protocol";

export interface McpConnection {
  serverId: string;
  connected: boolean;
  tools: ToolContract[];
}

/** Placeholder: connect to an MCP server */
export async function connect(_serverUrl: string): Promise<McpConnection> {
  return {
    serverId: "placeholder",
    connected: false,
    tools: [],
  };
}

/** Placeholder: discover tools from a connected MCP server */
export async function discoverTools(
  _connection: McpConnection
): Promise<ToolContract[]> {
  return _connection.tools;
}

/** Placeholder: disconnect from an MCP server */
export async function disconnect(_connection: McpConnection): Promise<void> {
  // TODO: implement disconnect
}
