---
name: role-prompt-creator
description: Create a new team member role prompt under .prompts and wire it into opencode.json. Invoke when you need to add/standardize a role in this repo.
compatibility: opencode
metadata:
  role: chief-tech-lead
  source: .prompts/chief-tech-lead.md
---

## When to use me
Use this when you need to add a new team member role (a role guideline prompt file) under `.prompts/` and make it available as an agent in `opencode.json`.

## What you will create/update
- Create: `.prompts/<role-key>.md`
- Update (if the role should be runnable as an agent): `opencode.json` under `agent.<role-key>.prompt` using `{file:./.prompts/<role-key>.md}`

## Naming rules
- Use kebab-case for the role key and prompt filename: `data-engineer` → `.prompts/data-engineer.md`
- Make the title in Title Case: `# Data Engineer Guideline`
- Keep role keys consistent across:
  - `opencode.json` agent key
  - `.prompts/<role-key>.md` filename

## Role prompt template (copy/paste)
Create `.prompts/<role-key>.md` with this structure and adapt it to the role:

```md
# <Role Display Name> Guideline

You are a <Role Display Name>. <One sentence: what you own and what you produce>.

## Role Scope
<1-2 sentences defining what this role owns and what it does not own>.

## Get Information From
- <Inputs this role should read, prefer repo paths and docs>

## Write To
- <Outputs this role should write/update, prefer repo paths and docs>

## Responsibilities
- <Verb-led bullets, describing the expected work outputs and quality gates>

## Boundaries
- <What not to do, and what not to edit>

## Documentation Rules
- <Markdown/diagram conventions used by this repo; match existing prompts>

## Reusable Best Practices
- Apply relevant skills: `<skill-1>`, `<skill-2>`

## Testing Gate
- <If this role writes code/tests, specify test expectations and reporting format>

## Final Report
- Provide a short summary of what you produced.
- List which docs you wrote or updated (paths only).
<If this role runs tests, require listing exact test commands and confirming they passed>.
```

## Consistency checklist
- Match section names and tone used by existing prompts in `.prompts/`.
- Use repository paths and placeholders consistently:
  - `<project-subfolder>/docs/...`
  - Existing project: `<project-subfolder>/docs/<feature-name>/...`
- Keep responsibilities output-oriented (docs/contracts/code/tests), not vague traits.
- Boundaries must explicitly prevent cross-team edits when appropriate.
- If the role is an implementer, include a testing gate requiring commands and a green result.

## Wiring the role into opencode.json
If the role should be callable as an agent, add an entry like:

```json
{
  "agent": {
    "<role-key>": {
      "prompt": "{file:./.prompts/<role-key>.md}"
    }
  }
}
```

Ensure you do not break JSON formatting and that the new agent key is unique.

## Example (quick)
Role key: `native-tech-lead`
- Prompt: `.prompts/native-tech-lead.md`
- Agent config: `opencode.json` → `agent.native-tech-lead.prompt = "{file:./.prompts/native-tech-lead.md}"`
