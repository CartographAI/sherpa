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

  const allowedDirectories = [];
  const urlOrDirectory = args[0];

  if (isGitUrl(urlOrDirectory)) {
    const repoDirectory = await cloneRepository(urlOrDirectory, cacheDirectory);
    allowedDirectories.push(repoDirectory);
  } else {
    allowedDirectories.push(urlOrDirectory);
  }

  const host = await createHost({ allowedDirectories });
  serveApi(host);
}

main();
