#!/usr/bin/env node
import { syncWorktrees } from "./sync-worktrees/index.js";

const configPath = process.argv[2] ?? "worktree-env-sync.json";

syncWorktrees(process.cwd(), configPath);
