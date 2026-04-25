# pi-execution-time

[pi](https://github.com/badlogic/pi-mono) package that adds a live task execution timer to the footer.

The timer starts when a prompt begins running and counts up until the agent finishes. It renders as a compact status item in the bottom bar next to pi's built-in cost and context usage indicators.

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

When the agent finishes, it keeps the final duration visible:

```text
✓ task 18s
```

Longer durations are formatted as `1m 05s` or `1h 02m 03s`.

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
