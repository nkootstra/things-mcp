# things-mcp

MCP server for [Things 3](https://culturedcode.com/things/) on macOS. Exposes the full [Things URL scheme](https://culturedcode.com/things/support/articles/2803573/) as tools — create to-dos, projects, bulk operations, and more.

Published as: `@nkootstra/things-mcp`

## Requirements

- macOS (Things 3 is macOS-only)
- [Things 3](https://culturedcode.com/things/) installed
- Node.js 18+ or Bun

## Setup

### Claude Desktop

Add to your `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "things": {
      "command": "npx",
      "args": ["-y", "@nkootstra/things-mcp"],
      "env": {
        "THINGS_AUTH_TOKEN": "your-auth-token-here"
      }
    }
  }
}
```

Then restart Claude Desktop.

### Claude Code

```bash
claude mcp add things -- npx -y @nkootstra/things-mcp
```

Set the auth token in your environment:

```bash
export THINGS_AUTH_TOKEN="your-auth-token-here"
```

### Other MCP clients

Run directly:

```bash
THINGS_AUTH_TOKEN="your-token" npx -y @nkootstra/things-mcp
```

Or install globally:

```bash
npm install -g @nkootstra/things-mcp
THINGS_AUTH_TOKEN="your-token" things-mcp
```

## Run and install examples

### 1) Run without installing globally

```bash
THINGS_AUTH_TOKEN="your-token" npx -y @nkootstra/things-mcp
```

### 2) Install globally and run

```bash
npm install -g @nkootstra/things-mcp
things-mcp
```

### 3) Claude Desktop config example

```json
{
  "mcpServers": {
    "things": {
      "command": "npx",
      "args": ["-y", "@nkootstra/things-mcp"],
      "env": {
        "THINGS_AUTH_TOKEN": "your-auth-token-here"
      }
    }
  }
}
```

### 4) What usage looks like in an MCP client

- "Add a to-do to buy groceries with a checklist for milk, eggs, and bread"
- "Create a project called Home Renovation with tasks for each room"
- "Show me my Today list"
- "Mark task XYZ as completed" (requires `THINGS_AUTH_TOKEN`)

## Getting your auth token

The auth token is only needed for **updating** existing items (not for creating new ones).

1. Open **Things 3**
2. Go to **Settings** → **General**
3. Enable **Things URLs**
4. Click **Manage** to reveal your authorization token
5. Copy the token and add it to your MCP client config

## Available tools

### Creating

| Tool | Description |
|---|---|
| `add-todo` | Create a to-do with title, notes, tags, checklist, scheduling, and more |
| `add-project` | Create a project with optional child to-dos |
| `add-json` | Bulk create/update using the [Things JSON format](https://culturedcode.com/things/support/articles/2803573/#json) — the most powerful tool |

### Updating (requires auth token)

| Tool | Description |
|---|---|
| `update-todo` | Modify any aspect of an existing to-do by ID |
| `update-project` | Modify any aspect of an existing project by ID |

### Navigating

| Tool | Description |
|---|---|
| `show` | Navigate Things to any item, project, area, or built-in list (inbox, today, upcoming, etc.) |
| `search` | Open the Things search screen with a query |
| `get-version` | Get Things URL scheme/client version info (with app-version fallback) |

## Examples

Here are some things you can ask an AI assistant to do:

- "Add a to-do to buy groceries with a checklist for milk, eggs, and bread"
- "Create a project called 'Home Renovation' with tasks for each room"
- "Schedule my task for tomorrow evening with a deadline of Friday"
- "Show me my Today list"
- "Mark task XYZ as completed" (needs auth token)
- "Create 10 tasks for my weekly review using the JSON tool"

## How it works

This server maps each [Things URL scheme command](https://culturedcode.com/things/support/articles/2803573/) to an MCP tool:

1. The AI assistant calls a tool (e.g., `add-todo` with `title: "Buy milk"`)
2. The server builds a `things:///` URL with the right parameters
3. The URL is executed via the macOS `open` command, which triggers Things 3
4. Things processes the command and creates/updates the item

### Response capture with xcall (optional)

By default, commands are fire-and-forget — Things processes them but doesn't return data to the server. If you install [xcall](https://github.com/martinfinke/xcall), the server will automatically use it to capture callback data like `x-things-id`, `x-things-ids`, and version fields.

## All parameters

Every parameter from the [Things URL scheme documentation](https://culturedcode.com/things/support/articles/2803573/) is supported. The tools use camelCase naming (e.g., `checklistItems` instead of `checklist-items`) which gets mapped to the correct URL parameters automatically.

### add-todo parameters

`title`, `titles`, `notes`, `when`, `deadline`, `tags`, `checklistItems`, `list`, `listId`, `heading`, `headingId`, `completed`, `canceled`, `reveal`, `showQuickEntry`, `useClipboard`, `creationDate`, `completionDate`

### add-project parameters

`title`, `notes`, `when`, `deadline`, `tags`, `area`, `areaId`, `todos`, `completed`, `canceled`, `reveal`, `creationDate`, `completionDate`

### update-todo parameters

`id`, `title`, `notes`, `prependNotes`, `appendNotes`, `when`, `deadline`, `tags`, `addTags`, `checklistItems`, `prependChecklistItems`, `appendChecklistItems`, `list`, `listId`, `heading`, `headingId`, `completed`, `canceled`, `reveal`, `duplicate`, `creationDate`, `completionDate`

### update-project parameters

`id`, `title`, `notes`, `prependNotes`, `appendNotes`, `when`, `deadline`, `tags`, `addTags`, `area`, `areaId`, `completed`, `canceled`, `reveal`, `duplicate`, `creationDate`, `completionDate`

### show parameters

`id`, `query`, `filter` (either `id` or `query` is required)

### search parameters

`query`

### add-json parameters

`items` (array of [Things JSON objects](https://culturedcode.com/things/support/articles/2803573/#json)), `reveal`

## Development

```bash
# Install dependencies
bun install

# Run with hot reload
bun run dev

# Run tests
bun test

# Build for npm
bun run build
```

## CI and npm release automation

- CI runs on GitHub Actions for all pushes to `main` and all pull requests:
  - `bun install --frozen-lockfile`
  - `bun test`
  - `bun run build`
- Versioning and tagging are automated via `.github/workflows/release-please.yml`:
  - Runs on pushes to `main`
  - Opens/updates a Release PR with version bump + changelog
  - When the Release PR is merged, it creates the version tag and GitHub Release
- npm publishing runs as part of the same `release-please.yml` workflow:
  - When the Release PR is merged and a GitHub Release is created, the workflow continues to build and publish
  - Publishes with provenance to npm (`npm publish --access public --provenance`)

### One-time setup

1. Ensure GitHub Actions are enabled for this repository.
2. Choose one publish auth method:
   - Recommended: npm Trusted Publishing for `@nkootstra/things-mcp`
     - npm → Package Settings → Trusted publishers → add this GitHub repository/workflow.
   - Token fallback: add repository secret `NPM_TOKEN`
     - Create an npm automation token with publish access to scope `@nkootstra`.
     - Add it in GitHub: Settings → Secrets and variables → Actions → New repository secret.

### Normal release flow (fully automated)

1. Merge changes into `main`.
2. Review and merge the automated Release PR from Release Please.
3. The same workflow creates the GitHub Release, builds the package, and publishes to npm.

### Commit message examples for Release Please

Use Conventional Commit style so release notes/versioning stay clean:

- `feat: add quick-entry support to add-todo`
- `fix: handle x-things-ids callback from json command`
- `chore: update docs for npm install examples`

## License

MIT
