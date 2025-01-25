# prj

I get it. As a 10x software enginer, its really hard to manage all of the repos you're working on. Now you can with this simple CLI tool to manage and organize your git projects in a consistent directory structure.

You're a pro. Get pro level repo management with `prj`.

## Installation

```bash
go install github.com/chandlerroth/current-projects/cmd/prj@latest
```

## Quick Start

1. Initialize your projects directory:
```bash
prj init
```
This creates a `~/Projects` directory and a `.current-projects` file.

2. Add new repos (with auto cloning):
```bash
prj add git@github.com:username/repo.git
```

3. Check git status of all projects:
```bash
prj status
```

## Available Commands

- `prj init` - Initialize the projects directory and configuration
- `prj add [repo]` - Add a repository to projects and install it
- `prj install` - Install/clone all projects from .current-projects file
- `prj status` - Show git status for all tracked projects

## Status Indicators

When running `prj status`, you'll see various indicators:
- `[↓]` - Number of commits behind remote
- `[↑]` - Number of commits ahead of remote
- `[N changes]` - Number of modified files
- `[✓ clean]` - Repository is clean with no changes

Example output:
```
~/Projects/chandlerroth/current-projects - git:(master)
```

## Project Structure

Projects are organized in the following structure:

```
~/Projects/username/repo
```

The `.current-projects` file in your Projects directory maintains the list of repositories to track. You can sync this to a gist.
