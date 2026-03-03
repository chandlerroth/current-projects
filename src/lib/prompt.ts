import { blue, gray, colors } from "./colors.ts";

interface SelectOption {
  label: string;
  value: string;
}

/**
 * Interactive select prompt with type-to-filter
 * All UI output goes to stderr, result goes to stdout
 */
export async function select(options: SelectOption[]): Promise<string | null> {
  if (options.length === 0) {
    return null;
  }

  let filter = "";
  let filtered = [...options];
  let selectedIndex = 0;
  const maxVisible = Math.min(20, options.length);
  // Reserve 1 extra line for the filter input
  const totalLines = maxVisible + 1;

  // Enable raw mode
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  const getFiltered = (): SelectOption[] => {
    if (!filter) return [...options];
    const lower = filter.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(lower));
  };

  const render = () => {
    // Move up and clear all lines
    process.stderr.write(`\x1b[${totalLines}A\x1b[J`);

    // Render filter line
    if (filter) {
      process.stderr.write(`  ${gray("filter:")} ${filter}\n`);
    } else {
      process.stderr.write(`  ${gray("type to filter...")}\n`);
    }

    // Calculate scroll window
    const visibleCount = Math.min(maxVisible, filtered.length);
    let startIndex = 0;
    if (visibleCount > 0 && selectedIndex >= visibleCount) {
      startIndex = selectedIndex - visibleCount + 1;
    }
    const endIndex = Math.min(startIndex + visibleCount, filtered.length);

    // Render visible options
    for (let i = startIndex; i < endIndex; i++) {
      const opt = filtered[i];
      const prefix = i === selectedIndex ? blue(">") : " ";
      const label = i === selectedIndex ? blue(opt.label) : opt.label;
      // Find original index for display number
      const originalIndex = options.indexOf(opt);
      const indexStr = `[${originalIndex + 1}]`.padEnd(5);
      process.stderr.write(`${prefix} ${indexStr} ${label}\n`);
    }

    // Fill remaining lines if filtered list is shorter
    for (let i = endIndex - startIndex; i < maxVisible; i++) {
      process.stderr.write("\n");
    }
  };

  // Initial render (blank lines first)
  for (let i = 0; i < totalLines; i++) {
    process.stderr.write("\n");
  }
  render();

  return new Promise((resolve) => {
    const onKeypress = (data: Buffer) => {
      const key = data.toString();

      // Ctrl+C or Escape
      if (key === "\x03" || key === "\x1b") {
        cleanup();
        resolve(null);
        return;
      }

      // Enter
      if (key === "\r" || key === "\n") {
        if (filtered.length > 0) {
          cleanup();
          resolve(filtered[selectedIndex].value);
        }
        return;
      }

      // Arrow up or Ctrl+P
      if (key === "\x1b[A" || key === "\x10") {
        selectedIndex = Math.max(0, selectedIndex - 1);
        render();
        return;
      }

      // Arrow down or Ctrl+N
      if (key === "\x1b[B" || key === "\x0e") {
        selectedIndex = Math.min(filtered.length - 1, selectedIndex + 1);
        render();
        return;
      }

      // Backspace
      if (key === "\x7f" || key === "\b") {
        if (filter.length > 0) {
          filter = filter.slice(0, -1);
          filtered = getFiltered();
          selectedIndex = 0;
          render();
        }
        return;
      }

      // Printable characters (filter input)
      if (key.length === 1 && key >= " " && key <= "~") {
        filter += key;
        filtered = getFiltered();
        selectedIndex = 0;
        render();
        return;
      }
    };

    const cleanup = () => {
      process.stdin.removeListener("data", onKeypress);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      // Clear the menu
      process.stderr.write(`\x1b[${totalLines}A\x1b[J`);
    };

    process.stdin.on("data", onKeypress);
  });
}
