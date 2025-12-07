# worktree-cli

A CLI tool for syncing environment files across git worktrees. It generates `.env` files by combining a shared template with worktree-specific input variables, and creates symlinks to distribute the env file to multiple locations within each worktree.

## Installation

```bash
npm install -g worktree-cli
```

## Usage

```bash
# Using default config file (worktree-env-sync.json)
worktree-env-sync

# Using a custom config file
worktree-env-sync my-config.json
```

## Config File

The config file is a JSON file with the following structure:

```json
{
  "template": ".env.template",
  "inputFilesToFolders": {
    ".env.worktree1": "worktrees/feature-a",
    ".env.worktree2": "worktrees/feature-b"
  },
  "outputFile": ".env.local",
  "symlinksToOuputFile": [
    "apps/web/.env.local",
    "apps/api/.env.local",
    "packages/db/.env.local"
  ]
}
```

| Field | Description |
|-------|-------------|
| `template` | Path to the template env file containing shared variables and interpolation references |
| `inputFilesToFolders` | Map of input env files to their target worktree folders |
| `outputFile` | Output filename for the generated env file (relative to each target folder) |
| `symlinksToOuputFile` | Paths where symlinks to the generated env file should be created (relative to each target folder) |

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
API_KEY=${API_KEY}
```

**Note:** All `${VAR}` references in the template must exist in the input files or the tool will fail, since missing variables would result in broken output. If input files contain variables not referenced in the template, a warning will be displayed but processing will continue, since the output is still valid.

### 3. Generated Output

Running `worktree-env-sync` generates an env file in each target folder with interpolated values:

```bash
# worktrees/feature-a/.env.local
APP_NAME="myapp"
APP_URL="http://localhost:3000"
DATABASE_CONNECTION="postgres://localhost/feature_a_db?pool=5"
API_KEY="dev-key-123"
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
- All `${VAR}` references in the template exist in the input files (fails if missing)
- Input variables not used in the template trigger a warning (but processing continues)
