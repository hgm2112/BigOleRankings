<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Safety: destructive and irreversible actions

Before taking any destructive or irreversible action, you MUST get the user's explicit confirmation that clearly states the action and its scope. Do not proceed on assumptions.

Destructive/irreversible actions include (but are not limited to):
- Deleting user accounts or auth users (e.g. Supabase `auth.users`), profiles, or identity records
- Deleting or wiping application data (rows/records), especially in bulk or for an entire user/account
- Dropping/truncating tables or schemas, running destructive migrations, or removing production/stored data
- Any operation that cannot be reliably undone

When requesting confirmation:
- State exactly what will be deleted/changed, for whom/which target (e.g. which user/account/environment), and that it is permanent/irreversible (and whether backups/PITR are known to exist, if relevant).
- Distinguish “delete this user’s app data” from “delete the account/auth user/profile” — treat them as different scopes and confirm each if both apply.
- Wait for an explicit “yes/proceed” to that specific scope before acting. If the user’s intent is ambiguous, ask a clarifying question instead of inferring.

## How to explain changes (novice-friendly)

When you finish work or answer questions, include a short **plain-English summary** first (2–5 sentences) for someone who isn’t technical:
- Say **what changed** in everyday words (what the app/site can do now).
- Say **exactly what I need to do next**, if anything — be specific and spell it out. List the exact steps, clicks, or words/commands I must use (for example: “Nothing you need to do.”, “Click **Save** on the settings page.”, or “Run this exact command: `...`” / “Say: `...`”). If I don’t need to do anything, say that clearly.
- Avoid jargon and long technical rundowns. If technical details are needed, put them **after** the simple summary under a separate “Details (optional)” heading.
