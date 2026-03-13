# prj

I get it. Its not easy to manage all of the repos you're working on. Now you can with this simple CLI tool to manage and organize your git projects in a consistent directory structure.

You're a pro. Get pro level repo management with `prj`.

## Installation

### Homebrew (macOS)

```bash
brew tap chandlerroth/tap
brew install prj
```

### Manual Installation

Download the latest release from [GitHub Releases](https://github.com/chandlerroth/prj/releases):

```bash
# macOS Apple Silicon
curl -L https://github.com/chandlerroth/prj/releases/latest/download/prj-darwin-arm64.tar.gz | tar xz
sudo mv prj-darwin-arm64 /usr/local/bin/prj

# macOS Intel
curl -L https://github.com/chandlerroth/prj/releases/latest/download/prj-darwin-x64.tar.gz | tar xz
sudo mv prj-darwin-x64 /usr/local/bin/prj

# Linux x64
curl -L https://github.com/chandlerroth/prj/releases/latest/download/prj-linux-x64.tar.gz | tar xz
sudo mv prj-linux-x64 /usr/local/bin/prj
```

### Build from Source

Requires [Bun](https://bun.sh):

```bash
git clone https://github.com/chandlerroth/prj.git
cd prj
bun install
bun build src/index.ts --compile --outfile prj
sudo mv prj /usr/local/bin/
```

## Shell Integration

For `prj list` and `prj rm` to change your shell's working directory, add this to your `~/.zshrc` or `~/.bashrc`:

```bash
curl -o ~/.prj.sh https://raw.githubusercontent.com/chandlerroth/prj/main/prj.sh
echo 'source ~/.prj.sh' >> ~/.zshrc
```

## Quick Start

```bash
# Initialize your projects directory
prj init

# Clone a repo (interactive picker if no repo given)
prj add user/repo
prj add

# Create a new private GitHub repo and clone it
prj create my-app

# Publish current directory as a private GitHub repo
prj create .

# Interactive project selector (changes directory on selection)
prj list

# Remove a project
prj rm      # interactive picker
prj rm 3    # by index
prj rm .    # current directory
```

## Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `prj init` | - | Initialize `~/Projects` directory |
| `prj add [repo]` | `a` | Clone a repository (interactive picker if no repo given) |
| `prj create <name>` | `c` | Create a new private GitHub repo and clone it |
| `prj create .` | - | Publish current directory as a private GitHub repo |
| `prj list` | `l` | Interactive project selector |
| `prj rm [index\|.]` | - | Remove a project (interactive picker if no index given) |

## Flags

| Flag | Description |
|------|-------------|
| `--non-interactive` | Disable interactive prompts (`list` prints status, `rm` requires index) |

## Status Indicators

```
[1]  chandlerroth/prj          git:(main) [✓ clean]
[2]  chandlerroth/other-repo   git:(main) [2↑ 3 changes]
[3]  org/some-project          git:(main) [1↓]
```

- `✓ clean` — No uncommitted changes, up to date with remote
- `N↑` — Commits ahead of remote
- `N↓` — Commits behind remote
- `N changes` — Uncommitted changes
- `Not installed` — Directory exists but is not a git repo

## Project Structure

Projects are organized under `~/Projects/<org>/<repo>`:

```
~/Projects/
├── username/
│   ├── repo1/
│   └── repo2/
└── org/
    └── repo3/
```

No config file — the filesystem is the source of truth.

## Development

```bash
# Run in development
bun run src/index.ts list

# Build binary
bun build src/index.ts --compile --outfile prj
```
