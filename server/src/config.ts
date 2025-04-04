import os from "node:os";
import path from "node:path";

export const configDirectory = path.join(os.homedir(), ".config", "sherpa");
export const mcpConfigPath = path.join(configDirectory, "mcp_servers.json");
