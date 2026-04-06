#!/usr/bin/env python3
"""
Experiment: Generate a narrative fictional story-style summary
from the full 20-year timeline of an existing playtest session.

Usage: python3 run.py
Requires: OPENAI_API_KEY in environment or in backend/.env
"""

import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path

SESSION_ID = "64cd0a5b-3af6-413f-8ce2-8c3cd6cb31cd"
MODEL = "gpt-5.2"

# Load DATABASE_URL from env or backend/.env
CONN = os.environ.get("DATABASE_URL")
if not CONN:
    env_file = Path(__file__).resolve().parents[2] / "backend" / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("DATABASE_URL="):
                CONN = line.split("=", 1)[1].strip()
                break
if not CONN:
    print("ERROR: DATABASE_URL not found in env or backend/.env", file=sys.stderr)
    sys.exit(1)

# ---- Load API key ----
API_KEY = os.environ.get("OPENAI_API_KEY")
if not API_KEY:
    env_file = Path(__file__).resolve().parents[2] / "backend" / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("OPENAI_API_KEY="):
                API_KEY = line.split("=", 1)[1].strip()
                break
if not API_KEY:
    print("ERROR: OPENAI_API_KEY not found", file=sys.stderr)
    sys.exit(1)

# ---- Fetch timeline from DB ----
print("Fetching timeline from database...")
result = subprocess.run(
    [
        "psql", CONN, "-t", "-c",
        f"""SELECT json_agg(
            json_build_object(
                'date', to_char(in_game_submitted_at, 'YYYY-MM'),
                'headline', COALESCE(selected_headline, headline_text)
            ) ORDER BY in_game_submitted_at
        )
        FROM game_session_headlines
        WHERE session_id = '{SESSION_ID}'
          AND in_game_submitted_at IS NOT NULL;"""
    ],
    capture_output=True, text=True, check=True,
)
timeline = json.loads(result.stdout.strip())
print(f"  Loaded {len(timeline)} headlines")

# ---- Build prompt ----
timeline_text = "\n".join(
    f"[{h['date']}] {h['headline']}" for h in timeline
)

SYSTEM_INSTRUCTIONS = """You are a literary fiction writer crafting a short story set against 20 years of real and imagined AI history. You are given a chronological list of news headlines spanning 2022 to 2046. Your task is NOT to summarise them, report them, or recap them — your task is to write a 600-800 word short story in the first person that feels authentic to this timeline.

The story should:
- Be written in first person, past tense
- Follow one fictional character (you invent them — name, job, era) living through this period
- Reference specific events from the headlines as background or personal moments in their life
- Show how AI reshaped their life, work, relationships, or beliefs
- Have a beginning, middle, and end — a narrative arc, not a bullet list
- Feel grounded and human, not grand or speeches-y
- Avoid game language: never mention headlines, rounds, players, scores, planets, or submissions

Your character should feel real. Show them noticing specific events, reacting to them, being changed by them. The headlines are their lived reality. Do not simply list events — make them part of a life being lived.

Always output valid JSON matching the required schema."""

USER_PROMPT = f"""Below is the timeline of events from 2022 to 2046 in this alternate history. Use it as the world your character lives in. Do not list or summarise the events — weave them into a first-person story.

=== TIMELINE ===
{timeline_text}

=== YOUR TASK ===
Write a 600-800 word first-person short story. Pick a character and era that speaks to you from this timeline. Have them notice specific events as they happen to them personally. End with them reflecting on how the world changed them."""

SCHEMA = {
    "name": "narrative_summary",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {
            "character": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "role": {"type": "string"},
                    "era": {"type": "string"},
                },
                "required": ["name", "role", "era"],
                "additionalProperties": False,
            },
            "story": {
                "type": "string",
                "description": "600-800 word first-person narrative story",
            },
            "themes_touched": {
                "type": "array",
                "items": {"type": "string"},
                "description": "3-5 phrases naming what the story is really about",
            },
        },
        "required": ["character", "story", "themes_touched"],
        "additionalProperties": False,
    },
}

# ---- Call OpenAI Responses API ----
print(f"Calling OpenAI Responses API (model={MODEL})...")
request_body = {
    "model": MODEL,
    "instructions": SYSTEM_INSTRUCTIONS,
    "input": USER_PROMPT,
    "text": {
        "format": {
            "type": "json_schema",
            **SCHEMA,
        }
    },
}

req = urllib.request.Request(
    "https://api.openai.com/v1/responses",
    data=json.dumps(request_body).encode(),
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    },
    method="POST",
)

try:
    with urllib.request.urlopen(req, timeout=300) as response:
        result = json.loads(response.read().decode())
except urllib.error.HTTPError as e:
    print(f"HTTP Error {e.code}: {e.read().decode()}", file=sys.stderr)
    sys.exit(1)

# Extract text output
output_text = None
for item in result.get("output", []):
    if item.get("type") == "message":
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                output_text = content.get("text")
                break

if not output_text:
    print("ERROR: No output_text in response", file=sys.stderr)
    print(json.dumps(result, indent=2))
    sys.exit(1)

parsed = json.loads(output_text)

# ---- Print + save ----
print("\n" + "=" * 70)
print("CHARACTER")
print("=" * 70)
print(f"Name: {parsed['character']['name']}")
print(f"Role: {parsed['character']['role']}")
print(f"Era:  {parsed['character']['era']}")
print()
print("=" * 70)
print("STORY")
print("=" * 70)
print(parsed["story"])
print()
print("=" * 70)
print("THEMES")
print("=" * 70)
for theme in parsed["themes_touched"]:
    print(f"  - {theme}")

# Save output
output_file = Path(__file__).parent / "output.md"
output_file.write_text(
    f"""# Narrative Summary Experiment

**Session:** {SESSION_ID}
**Model:** {MODEL}
**Headlines:** {len(timeline)}

---

## Character

- **Name:** {parsed['character']['name']}
- **Role:** {parsed['character']['role']}
- **Era:** {parsed['character']['era']}

## Story

{parsed['story']}

## Themes Touched

{chr(10).join(f'- {t}' for t in parsed['themes_touched'])}

---

## Prompt Used

### System Instructions

```
{SYSTEM_INSTRUCTIONS}
```

### User Prompt (timeline truncated)

```
Below is the timeline of events from 2022 to 2046 in this alternate history.
Use it as the world your character lives in. Do not list or summarise the
events — weave them into a first-person story.

=== TIMELINE ===
{chr(10).join(f"[{h['date']}] {h['headline']}" for h in timeline[:10])}
... ({len(timeline) - 10} more headlines) ...

=== YOUR TASK ===
Write a 600-800 word first-person short story. Pick a character and era
that speaks to you from this timeline. Have them notice specific events
as they happen to them personally. End with them reflecting on how the
world changed them.
```

## Stats

- Input tokens: {result.get('usage', {}).get('input_tokens', 'N/A')}
- Output tokens: {result.get('usage', {}).get('output_tokens', 'N/A')}
"""
)
print(f"\nSaved to {output_file}")
