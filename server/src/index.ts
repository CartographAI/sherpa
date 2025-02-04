#!/usr/bin/env node

import { serveApi } from "./api";
import { createHost } from "./host";
import os from "os";
import path from "path";
import { cloneRepository, isGitUrl } from "./utils/git";

const cacheDirectory = path.join(os.homedir(), ".cache", "sherpa");

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(
      "Please specify a directory or git url to use sherpa with.\nUsage: npx sherpa <git_url> or npx sherpa <path/to/directory>",
    );
    process.exit(1);
  }

  if (args.length > 1) {
    console.error("Error: Only one directory or git url can be specified at a time.");
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

  const open = await import("open");
  open.default("http://localhost:3031");
}

main();
