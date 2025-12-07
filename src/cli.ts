#!/usr/bin/env node
import { syncWorktrees } from "./sync-worktrees/index.js";

const configPath = process.argv[2] ?? "sync-env.json";

syncWorktrees(process.cwd(), configPath);
