# Dynamic greetings

When you open omanote, the header greets you with something different depending on the time of day — a small touch that makes the workspace feel alive rather than static.

## How it works

The greeting is generated from two things: **the current hour** and **your name**. Based on the time of day, it picks from one of five buckets:

| Time | Bucket |
|---|---|
| 4–7 am | Early |
| 7 am–12 pm | Morning |
| 12–5 pm | Afternoon |
| 5–9 pm | Evening |
| 9 pm–4 am | Night |

Each bucket has two dozen phrases, rotated deterministically so the same time-of-day on the same date always shows the same greeting — but it changes day to day.

## What you see

On desktop you see the full greeting with your name: *"☀️ Morning, Alex"* or *"🌙 Night owl, Jamie"*. On mobile it shortens to just the emoji and name to save space.

## Your name comes from your profile

The greeting uses the display name from your account (set in your profile — see **Profile & account**). If no name is set, it falls back to "there."
