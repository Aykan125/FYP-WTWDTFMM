# If Time Permits

Low-priority features and improvements to implement if time allows.

## LLM Fallback Heuristic

**Purpose:** Graceful degradation when OpenAI API is unavailable.

**What it would do:**
- Assign default plausibility band (e.g., band 3)
- Use player's original headline text without transformation
- Skip planet classification or use keyword matching
- Skip connection detection (no story bonuses)

**Why deprioritized:** The LLM integration works reliably. Adding fallback logic adds complexity for an edge case unlikely to occur during demos/playtests.

---
