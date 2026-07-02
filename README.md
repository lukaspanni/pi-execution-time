# pi-execution-time

[pi](https://github.com/badlogic/pi-mono) package that adds live task and session timers.

The task timer starts when a prompt begins running and counts up until the agent finishes. A separate session timer keeps counting from session start. Both render as compact status items in the bottom bar next to pi's built-in cost and context usage indicators.

## Install

From GitHub:

```bash
pi install https://github.com/lukaspanni/pi-execution-time
```

From npm after publishing:

```bash
pi install npm:pi-execution-time
```

## Usage

Reload or restart pi after installation. When the agent is working, the footer shows a live timer:

```text
⏱ 4.2s
```

When the agent finishes, it keeps the final duration and completion time visible:

```text
✓ task 18s · 17:42
```

The bottom bar also shows the total elapsed session time and keeps updating it every second:

```text
Σ session 12m 04s
```

Completed standard user prompts are rendered above the next standard user prompt:

```text
✓ step 1 18s · 17:42
```

Steering messages are ignored for step history. Longer durations are formatted as `1m 05s` or `1h 02m 03s`. Completion time is shown as local `HH:mm`.

## Local development

```bash
npm install
npm run validate
pi -e ./extensions/execution-time.ts
```

## Package contents

- `extensions/execution-time.ts` - registers the footer status timer

## License

MIT
