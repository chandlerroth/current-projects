import { blue, colors } from "./colors.ts";

interface SelectOption {
  label: string;
  value: string;
}

/**
 * Interactive select prompt using raw stdin
 * All UI output goes to stderr, result goes to stdout
 */
export async function select(options: SelectOption[]): Promise<string | null> {
  if (options.length === 0) {
    return null;
  }

  let selectedIndex = 0;
  const maxVisible = Math.min(20, options.length);

  // Enable raw mode
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  process.stdin.resume();

  const render = () => {
    // Clear previous output
    process.stderr.write(`\x1b[${maxVisible}A\x1b[J`);

    // Calculate scroll window
    let startIndex = 0;
    if (selectedIndex >= maxVisible) {
      startIndex = selectedIndex - maxVisible + 1;
    }
    const endIndex = Math.min(startIndex + maxVisible, options.length);

    // Render visible options
    for (let i = startIndex; i < endIndex; i++) {
      const opt = options[i];
      const prefix = i === selectedIndex ? blue(">") : " ";
      const label = i === selectedIndex ? blue(opt.label) : opt.label;
      const indexStr = `[${i + 1}]`.padEnd(5);
      process.stderr.write(`${prefix} ${indexStr} ${label}\n`);
    }
  };

  // Initial render (with blank lines first)
  for (let i = 0; i < maxVisible; i++) {
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
        cleanup();
        resolve(options[selectedIndex].value);
        return;
      }

      // Arrow keys
      if (key === "\x1b[A" || key === "k") {
        // Up
        selectedIndex = Math.max(0, selectedIndex - 1);
        render();
      } else if (key === "\x1b[B" || key === "j") {
        // Down
        selectedIndex = Math.min(options.length - 1, selectedIndex + 1);
        render();
      }
    };

    const cleanup = () => {
      process.stdin.removeListener("data", onKeypress);
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.pause();
      // Clear the menu
      process.stderr.write(`\x1b[${maxVisible}A\x1b[J`);
    };

    process.stdin.on("data", onKeypress);
  });
}
