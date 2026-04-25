---
name: example-skill
description: Demonstrates a packaged pi skill. Use when the user asks how this package's sample skill works or wants a small checklist-style workflow.
license: MIT
---

# Example Skill

Use this skill as a starting point for your own packaged workflows.

## Workflow

1. Restate the user's goal in one sentence.
2. Inspect the relevant repository files before changing code.
3. Make the smallest safe change.
4. Run the package validation command:

```bash
npm run validate
```

## Customization

Rename this directory and update the `name` frontmatter. Skill names must be lowercase, hyphen-separated, and match the parent directory name.
