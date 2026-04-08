/**
 * Emit a shell function wrapper that auto-cd's into paths printed by prj.
 *
 * Usage in ~/.zshrc or ~/.bashrc:
 *   eval "$(prj shell-init)"
 *
 * The wrapper captures prj's stdout. If it's a directory, cd into it; if it's
 * any other non-empty string, echo it; otherwise do nothing. This works for
 * every prj subcommand uniformly — no per-command branching.
 */
const SNIPPET = `prj() {
  local out
  out=$(command prj "$@") || return
  if [ -n "$out" ] && [ -d "$out" ]; then
    cd "$out"
  elif [ -n "$out" ]; then
    echo "$out"
  fi
}
`;

export async function runShellInit(): Promise<void> {
  process.stdout.write(SNIPPET);
}
