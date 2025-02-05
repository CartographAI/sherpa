#!/usr/bin/env node

import os from "node:os";
import path from "node:path";
import open from "open";
import { serveApi } from "./api.js";
import { createHost } from "./host.js";
import { cloneRepository, isGitUrl } from "./utils/git.js";
import { log } from "./utils/logger.js";

const cacheDirectory = path.join(os.homedir(), ".cache", "sherpa");

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

  const host = await createHost({ allowedDirectory });
  serveApi(host);
  await open("http://localhost:3031");
}

main();
