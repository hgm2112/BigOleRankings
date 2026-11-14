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
