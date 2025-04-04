#!/usr/bin/env node

import open from "open";
import { serveApi } from "./api.js";
import { createHost } from "./host.js";
import { mcpManager } from "./mcpTools/mcpManager.js";
import { cloneRepository, isGitUrl } from "./utils/git.js";
import { log } from "./utils/logger.js";
import { cacheDirectory } from "./config.js";

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    log.error(
      "Please specify a directory or git url to use sherpa with.\nUsage: npx sherpa <git_url> or npx sherpa <path/to/directory>",
    );
    process.exit(1);
  }

  if (args.length > 1) {
    log.error("Error: Only one directory or git url can be specified at a time.");
    process.exit(1);
  }

  const urlOrDirectory = args[0];
  let allowedDirectory: string;

  if (isGitUrl(urlOrDirectory)) {
    allowedDirectory = await cloneRepository(urlOrDirectory, cacheDirectory);
  } else {
    allowedDirectory = urlOrDirectory;
  }

  await mcpManager.initialize();

  const host = await createHost({ allowedDirectory });
  serveApi(host);
  await open("http://localhost:3031");

  // Graceful shutdown
  process.on("SIGINT", async () => {
    log.info("Received SIGINT. Shutting down gracefully...");
    await mcpManager.cleanup();
    await host.cleanup(); // Assuming host might have cleanup logic too
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    log.info("Received SIGTERM. Shutting down gracefully...");
    await mcpManager.cleanup();
    await host.cleanup();
    process.exit(0);
  });
}

main().catch((error) => {
  log.error("Unhandled error during startup:", error);
  process.exit(1);
});
