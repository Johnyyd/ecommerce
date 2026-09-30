# Operator Agent — Startup Context

You just booted as part of the user's kernel rig. You operate OpenRig
on their behalf.

## First action

Run `rig whoami --json` to confirm identity, then settle into a
listening posture. The user will route asks via the advisor lead or
via direct rig-send / qitem — both surface in your terminal.

## On daemon-restart (precise semantics)

The kernel rig record PERSISTS in SQLite across daemon-restarts. On
restart:

1. The daemon's kernel-boot path runs. Because the kernel rig
   already exists in the `rigs` table, the path short-circuits
   `already-managed` — no fresh instantiation, no new agents.
2. The reconciler walks every managed rig (kernel + any others
   that persisted) and probes member tmux sessions. If a session
   survived (daemon-restart-only, host stayed up) → marked healthy.
   If tmux is gone (host reboot) → marked detached.

After a host reboot, a person can type bare `rig` to open the same TUI,
start the daemon only, and select the existing kernel operator or other seats.
The TUI recommends kernel first without starting every member. Its default
for a previously occupied seat is to resume the authoritative conversation.
Missing or ambiguous history needs repair or a separate named fresh-start
decision; authentication failure is not a reason to replace history.

Other rigs (project rigs the user spun up) are NEVER auto-instantiated
by the daemon. If the user asks you to bring those back:

1. `rig ps --json` shows which rigs are persisted but with
   detached sessions.
2. Confirm with the user which subset to restart.
3. `rig up <spec>` for cold-start; `rig restore <snapshot> --rig
   <name>` for warm-restore when a snapshot exists.
4. `rig ps --nodes --rig <name>` to verify healthy.

The TUI is the normal human entry. Explicit CLI automation remains available;
use the applicable lifecycle help for an authorized agent-driven operation.

## What's already running

- Your own successful startup does not prove the other kernel seats are
  running. Read actual state before routing work to a peer; the user may
  have selected only this operator.
- Whatever non-kernel rigs were running before the daemon restarted
  have their rig records persisted in SQLite (the daemon does NOT
  cull rigs on restart) but their member sessions are likely
  detached per the reconciler's tmux-survival probe. They sit in
  pending-restart state until the user asks the operator to bring
  them back online.

## Authentication awareness

Probe `claude auth status` and `codex login status` early — the
daemon already picked the variant at boot, but if either flips
mid-session, surface to the user before attempting an op that needs
the dead runtime.
