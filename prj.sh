#!/bin/bash
# Shell integration for prj command
# Add to ~/.zshrc or ~/.bashrc:
#   source <(curl -s https://raw.githubusercontent.com/chandlerroth/current-projects/main/prj.sh)
# Or download and source locally:
#   curl -o ~/.prj.sh https://raw.githubusercontent.com/chandlerroth/current-projects/main/prj.sh
#   source ~/.prj.sh

prj() {
  if [[ "$1" == "l" ]] || [[ "$1" == "list" ]]; then
    local tmpfile=$(mktemp)
    command prj "$@" > "$tmpfile"
    local selected_path=$(cat "$tmpfile")
    rm -f "$tmpfile"
    if [[ -n "$selected_path" ]] && [[ -d "$selected_path" ]]; then
      cd "$selected_path"
    elif [[ -n "$selected_path" ]]; then
      echo "$selected_path"
    fi
  elif [[ "$1" == "cd" ]]; then
    local tmpfile=$(mktemp)
    command prj "$@" > "$tmpfile"
    local selected_path=$(cat "$tmpfile")
    rm -f "$tmpfile"
    if [[ -n "$selected_path" ]] && [[ -d "$selected_path" ]]; then
      cd "$selected_path"
    elif [[ -n "$selected_path" ]]; then
      echo "$selected_path"
    fi
  elif [[ "$1" == "rm" ]]; then
    local tmpfile=$(mktemp)
    command prj "$@" > "$tmpfile"
    local output=$(cat "$tmpfile")
    rm -f "$tmpfile"
    # Last line is the parent directory to cd into
    local parent_dir=$(echo "$output" | tail -n 1)
    # Print all but the last line
    echo "$output" | head -n -1
    if [[ -n "$parent_dir" ]] && [[ -d "$parent_dir" ]]; then
      cd "$parent_dir"
    fi
  else
    command prj "$@"
  fi
}
