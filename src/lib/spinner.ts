const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export class Spinner {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private frameIndex = 0;
  private message: string;
  private stopped = false;

  constructor(message: string = "Loading") {
    this.message = message;
  }

  start(): void {
    this.stopped = false;
    // Only show spinner in TTY
    if (!process.stderr.isTTY) return;

    // Hide cursor and show initial frame
    process.stderr.write("\x1b[?25l");
    process.stderr.write(`${frames[0]} ${this.message}`);

    this.intervalId = setInterval(() => {
      if (this.stopped) return;
      this.frameIndex = (this.frameIndex + 1) % frames.length;
      const frame = frames[this.frameIndex];
      process.stderr.write(`\r${frame} ${this.message}`);
    }, 80);
  }

  stop(clearLine = true): void {
    this.stopped = true;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Only show spinner cleanup in TTY
    if (!process.stderr.isTTY) return;

    if (clearLine) {
      // Clear line and move cursor to start
      process.stderr.write("\r\x1b[K");
    } else {
      process.stderr.write("\n");
    }

    // Show cursor
    process.stderr.write("\x1b[?25h");
  }

  setText(message: string): void {
    this.message = message;
  }
}
