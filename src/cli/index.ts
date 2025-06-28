#!/usr/bin/env node

// Re-export the CLI functionality
export * from "./autonomous-coding-cli.js";

// If this file is run directly, execute the CLI
import("./autonomous-coding-cli.js");
