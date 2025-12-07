# worktree-cli

A CLI tool for syncing environment files across git worktrees. It generates `.env` files by combining a shared template with worktree-specific input variables, and creates symlinks to distribute the env file to multiple locations within each worktree.

## Installation

```bash
npm install -g worktree-cli
```

## Usage

```bash
# Using default config file (sync-env.json)
sync-worktree

# Using a custom config file
sync-worktree my-config.json
```

## Config File

The config file is a JSON file with the following structure:

```json
{
  "template": ".env.template",
  "outputPath": ".env.local",
  "targetFolders": {
    ".env.worktree1": "worktrees/feature-a",
    ".env.worktree2": "worktrees/feature-b"
  },
  "symlinks": [
    "apps/web/.env.local",
    "apps/api/.env.local",
    "packages/db/.env.local"
  ]
}
```

| Field | Description |
|-------|-------------|
| `template` | Path to the template env file containing shared variables and interpolation references |
| `outputPath` | Output filename for the generated env file (relative to each target folder) |
| `targetFolders` | Map of input env files to their target worktree folders |
| `symlinks` | Paths where symlinks to the generated env file should be created (relative to each target folder) |

## How It Works

### 1. Input Files

Create an input env file for each worktree containing worktree-specific variables:

```bash
# .env.worktree1
DATABASE_URL=postgres://localhost/feature_a_db
API_KEY=dev-key-123
```

```bash
# .env.worktree2
DATABASE_URL=postgres://localhost/feature_b_db
API_KEY=dev-key-456
```

### 2. Template File

Create a template file with shared variables. Use `${VAR_NAME}` syntax to reference variables from the input files:

```bash
# .env.template
APP_NAME=myapp
APP_URL=http://localhost:3000
DATABASE_CONNECTION=${DATABASE_URL}?pool=5
```

### 3. Generated Output

Running `sync-worktree` generates an env file in each target folder combining both sections:

```bash
# worktrees/feature-a/.env.local
# Input variables
DATABASE_URL="postgres://localhost/feature_a_db"
API_KEY="dev-key-123"

# Template variables
APP_NAME="myapp"
APP_URL="http://localhost:3000"
DATABASE_CONNECTION="postgres://localhost/feature_a_db?pool=5"
```

### 4. Symlinks

Symlinks are created at each path specified in `symlinks`, pointing to the generated env file. This allows monorepo packages to share the same env file:

```
worktrees/feature-a/
├── .env.local                      # Generated env file
├── apps/
│   ├── web/.env.local              # Symlink → ../../.env.local
│   └── api/.env.local              # Symlink → ../../.env.local
└── packages/
    └── db/.env.local               # Symlink → ../../.env.local
```

## Validation

The tool validates that:

- All input files have the same set of keys
- Template and input files don't have conflicting keys
- All `${VAR}` references in the template exist in the input files
