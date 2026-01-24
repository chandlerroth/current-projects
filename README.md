# prj

We get it. You're a 10x software engineer, and it's not easy to manage all of the repos you're working on. Now you can with this simple CLI tool to manage and organize your git projects in a consistent directory structure.

You're a pro. Get pro level repo management with `prj`.

## Installation

### Homebrew (macOS)

```bash
brew tap chandlerroth/tap
brew install prj
```

### Manual Installation

Download the latest release from [GitHub Releases](https://github.com/chandlerroth/current-projects/releases) and extract to your PATH:

```bash
# macOS Apple Silicon
curl -L https://github.com/chandlerroth/current-projects/releases/latest/download/prj-darwin-arm64.tar.gz | tar xz
sudo mv prj-darwin-arm64 /usr/local/bin/prj

# macOS Intel
curl -L https://github.com/chandlerroth/current-projects/releases/latest/download/prj-darwin-x64.tar.gz | tar xz
sudo mv prj-darwin-x64 /usr/local/bin/prj

# Linux x64
curl -L https://github.com/chandlerroth/current-projects/releases/latest/download/prj-linux-x64.tar.gz | tar xz
sudo mv prj-linux-x64 /usr/local/bin/prj
```

### Build from Source

Requires [Bun](https://bun.sh):

```bash
git clone https://github.com/chandlerroth/current-projects.git
cd current-projects
bun install
bun build src/index.ts --compile --outfile prj
sudo mv prj /usr/local/bin/
```

## Shell Integration

For `prj list` and `prj cd` to change your shell's working directory, add this to your `~/.zshrc` or `~/.bashrc`:

```bash
source /path/to/prj.sh
```

Or download directly:

```bash
curl -o ~/.prj.sh https://raw.githubusercontent.com/chandlerroth/current-projects/main/prj.sh
echo 'source ~/.prj.sh' >> ~/.zshrc
```

## Quick Start

1. Initialize your projects directory:
```bash
prj init
```
This creates a `~/Projects` directory and a `.current-projects` config file.

2. Add new repos (with auto cloning):
```bash
prj add git@github.com:username/repo.git
```

3. Check git status of all projects:
```bash
prj status
```

4. Jump to a project:
```bash
prj list    # Interactive selection
prj cd 1    # Jump to project #1
```

## Available Commands

| Command | Alias | Description |
|---------|-------|-------------|
| `prj init` | - | Initialize ~/Projects directory and config |
| `prj add <repo>` | `a` | Add a repository and clone it |
| `prj install` | `i` | Clone all repositories from config |
| `prj status` | `s` | Show git status for all projects |
| `prj list` | `l` | Interactive project selector |
| `prj cd <index>` | - | Output project path by index |

## Status Indicators

When running `prj status`, you'll see various indicators:

- `[↓]` - Commits behind remote
- `[↑]` - Commits ahead of remote
- `[N changes]` - Modified files
- `[✓ clean]` - Repository is clean

Example output:
```
[1]  chandlerroth/current-projects  git:(main) [✓ clean]
[2]  chandlerroth/other-project     git:(main) [2↑ 3 changes]
```

## Project Structure

Projects are organized in the following structure:

```
~/Projects/
├── .current-projects    # Config file with repo URLs
├── username1/
│   ├── repo1/
│   └── repo2/
└── username2/
    └── repo3/
```

The `.current-projects` file maintains the list of repositories to track. You can sync this to a gist or back it up however you like.

## Development

```bash
# Run in development
bun run src/index.ts status

# Build binary
bun build src/index.ts --compile --outfile prj
```
