#!/usr/bin/env node

import { serveApi } from "./api";
import { createHost } from "./host";

async function main() {
  const allowedDirectories = process.argv.slice(2);
  if (allowedDirectories.length === 0) {
    console.log("No directories specified. Usage: npx sherpa path/to/dir1 [dir2] [...]");
    process.exit(1);
  }

  const host = await createHost({ allowedDirectories });
  serveApi(host);
}

main();
