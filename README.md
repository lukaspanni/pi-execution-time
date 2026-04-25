# pi-package-template

GitHub repository template for [pi](https://github.com/badlogic/pi-mono) packages. Use it to ship extensions, skills, prompt templates, and themes through GitHub or npm.

## Use this template

1. Click **Use this template** on GitHub, or create from the CLI:

   ```bash
   gh repo create lukaspanni/my-pi-package --template lukaspanni/pi-package-template --public --clone
   ```

2. Rename package metadata in `package.json`:
   - `name`
   - `description`
   - `repository.url`
   - `author`
   - `keywords`

3. Replace or remove the sample resources:
   - `extensions/hello.ts`
   - `skills/example-skill/SKILL.md`
   - `prompts/review-package.md`
   - `themes/package-template-dark.json`

4. Install and validate:

   ```bash
   npm install
   npm run validate
   ```

## Package structure

```text
.
├── extensions/                 # TypeScript extensions loaded by pi
│   └── hello.ts                # sample /hello command and hello_package tool
├── skills/                     # Agent Skills; each folder has SKILL.md
│   └── example-skill/
│       └── SKILL.md
├── prompts/                    # Slash prompt templates; filename = command
│   └── review-package.md       # /review-package
├── themes/                     # pi TUI themes
│   └── package-template-dark.json
├── .github/workflows/
│   └── publish.yml             # tag-based npm publish workflow
├── package.json                # npm metadata and pi manifest
└── tsconfig.json               # TypeScript integration for extensions
```

## Install the package in pi

From GitHub:

```bash
pi install https://github.com/lukaspanni/pi-package-template
```

From npm after publishing:

```bash
pi install npm:pi-package-template
```

For local development, run pi with the extension directly:

```bash
pi -e ./extensions/hello.ts
```

Or install the whole local package:

```bash
pi install ./path/to/pi-package-template
```

## Included examples

### Extension

`extensions/hello.ts` demonstrates:

- importing `ExtensionAPI` from `@mariozechner/pi-coding-agent`
- registering a slash command (`/hello`)
- registering a typed LLM tool (`hello_package`) with `typebox`

### Skill

`skills/example-skill/SKILL.md` follows the Agent Skills shape used by pi:

- lowercase hyphenated skill name
- `description` frontmatter for discovery
- instructions that can reference files relative to the skill directory

### Prompt template

`prompts/review-package.md` becomes `/review-package` in pi and demonstrates frontmatter plus `$ARGUMENTS`.

### Theme

`themes/package-template-dark.json` includes all required pi theme tokens and a schema URL for editor validation.

## npm scripts

```bash
npm run typecheck   # tsc --noEmit over extensions/**/*.ts
npm run pack:check  # npm pack --dry-run to inspect published files
npm run validate    # typecheck + pack check
```

## Publishing to npm

The included workflow publishes when you push a `v*` tag or run it manually.

Recommended release flow:

```bash
npm version patch
git push --follow-tags
```

The workflow uses npm trusted publishing/provenance (`id-token: write`). Configure the package on npm for trusted publishing, or replace the publish step with `NODE_AUTH_TOKEN`-based publishing if preferred.

## pi manifest

`package.json` declares all resource directories explicitly:

```json
"pi": {
  "extensions": ["./extensions"],
  "skills": ["./skills"],
  "prompts": ["./prompts"],
  "themes": ["./themes"]
}
```

Pi can also auto-discover conventional directories, but keeping the manifest explicit makes package contents obvious.

## Notes

- Runtime dependencies used by extensions belong in `dependencies`.
- pi-provided packages (`@mariozechner/pi-coding-agent`, `@mariozechner/pi-ai`, `@mariozechner/pi-agent-core`, `@mariozechner/pi-tui`, `typebox`) should be `peerDependencies` with `"*"`.
- Keep `files` in `package.json` aligned with resources you want to publish.

## License

MIT
