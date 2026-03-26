# Playtest 1 Statistics — Session UD0T2Q (2026-03-08)

## Game Configuration
- **Players:** 11 (+ Archive system player)
- **Rounds:** 3 x 10min play, 2 x 3min break = 36 min total
- **Cooldown:** 60 seconds between submissions
- **Timeline speed ratio:** 490,896

---

## 1. Headline Volume

| Metric | Value |
|---|---|
| **Total headlines** | 218 (player) + 36 (archive) = 254 |
| **Per round** | R1: 67 player + 36 archive, R2: 74, R3: 77 |
| **Avg per player per round** | ~6.6 |

### Headlines per player (total)
```
netrunner  ████████████████████████████ 26
abo        ██████████████████████████ 22
nono       ██████████████████████████ 22
lewis3142  █████████████████████████ 21
Louis      █████████████████████████ 21
Hao        ████████████████████████ 20
Ayman      ███████████████████████ 19
Michal     ███████████████████████ 19
moiz       █████████████████████ 17
Kang       ████████████████████ 16
Brian G    ██████████████████ 15
```

### Headlines per player per round
```
           R1  R2  R3
netrunner   8   9   9
abo         7   7   8
nono        7   7   8
lewis3142   7   7   7
Louis       7   7   7
Hao         6   7   7
Michal      6   7   6
Ayman       5   7   7
moiz        5   6   6
Kang        5   5   6
Brian G     4   5   6
```
**Observation:** Players generally improved submission rate across rounds. Minimum was 4 (Brian G, R1), maximum 9 (netrunner, R2/R3). Most players hit 6-7 per round — suggests the 60s cooldown is roughly right for 10 min rounds.

---

## 2. Submission Timing

| Metric | Value |
|---|---|
| **Average gap** | 87.0s |
| **Median gap** | 78.9s |
| **Minimum gap** | 68.8s |
| **Maximum gap** | 173.9s |

The 60s cooldown + thinking/typing time gives a practical floor of ~69s. Median near 79s means most players submit almost as soon as cooldown expires. The long tail (up to 174s) suggests some players occasionally take reading breaks naturally.

---

## 3. Score Breakdown

### Overall score composition (% of total points)
```
Baseline (5pts flat)     ████████████████████████████████████████████████ 45.4%
Others-Connection (3pts) ████████████████████████████ 23.7%
Planet Bonus (3pts)      ████████████████████████ 20.6%
Plausibility (0-2pts)    ████████████ 10.2%
Self-Connection          ░░ 0.0%
```

### Average per headline
| Component | Avg Points | Max Possible |
|---|---|---|
| Baseline | 5.00 | 5 |
| Plausibility | 1.12 | 2 |
| Self-story | 0.00 | 1 |
| Others-story | 2.61 | 3 |
| Planet bonus | 2.27 | 3 |
| **Total** | **11.00** | **14** |

**Key insight:** Baseline dominates at 45.4% of all points. Everyone gets 5pts just for submitting, making quantity the primary strategy. This drives the "fighting about points" observation — more headlines = more guaranteed baseline.

### Per-player score breakdown
```
           Base  Plaus  Self  Other  Planet  TOTAL  #Headlines
netrunner   130    26     0     74     60     290      26
Louis       105    30     0     51     60     246      21
lewis3142   105    26     0     57     54     242      21
abo         110    23     0     48     60     241      22
Hao         100    20     0     57     54     231      20
nono        110    24     0     53     39     226      22
Michal       95    18     0     54     39     206      19
Ayman        95    21     0     44     45     205      19
Kang         80    18     0     48     45     191      16
moiz         85    25     0     49     27     186      17
Brian G      75    14     0     34     12     135      15
```

**Correlation:** netrunner won with most headlines (26). Rank order closely tracks headline count. Reducing baseline from 5 to 1 would significantly shift this.

---

## 4. Plausibility Distribution

| Level | Count | Score | Description |
|---|---|---|---|
| 1 (very implausible) | 7 | 0 | 3.2% |
| 2 (somewhat implausible) | 85 | 1 | 39.0% |
| 3 (neutral) | 60 | 2 | 27.5% |
| 4 (somewhat plausible) | 40 | 1 | 18.3% |
| 5 (very plausible) | 26 | 0 | 11.9% |

The middle band (level 3 = 2pts) rewards "interestingly plausible" headlines. Distribution is roughly normal centered at level 2-3.

---

## 5. Planet System

### AI-assigned planets (across all 3 slots, all 218 headlines)
```
JUPITER  █████████████████████████████████████████████████████████████████ 128  (19.6%)
URANUS   ██████████████████████████████████████████████████████ 107  (16.4%)
MERCURY  ██████████████████████████████████████████████████ 93   (14.2%)
PLUTO    ████████████████████████████████████████████ 86   (13.2%)
NEPTUNE  ████████████████████████████ 53   (8.1%)
SATURN   ████████████████████████████ 53   (8.1%)
MARS     ████████████████████████████ 53   (8.1%)
EARTH    █████████████████████ 41   (6.3%)
VENUS    █████████████████████ 40   (6.1%)
```

**Problem:** JUPITER (Power, Governance, Politics) and URANUS (Innovation, Revolution, Disruption) dominate massively — together 36% of all mentions. EARTH/VENUS are rare. This makes priority planet bonuses unfair if you get assigned a rare planet.

### Planet slot 1 (primary planet) distribution
```
MARS     ████████████████████████████████████████████ 42
EARTH    █████████████████████████████████████ 37
NEPTUNE  █████████████████████████████████ 33
VENUS    ██████████████████████████████ 31
JUPITER  ██████████████████████████ 26
MERCURY  ██████████████████████ 22
URANUS   █████████████████ 17
SATURN   ████████ 8
PLUTO    ██  2
```

**Interesting:** Slot 1 distribution is almost inverse of overall! MARS/EARTH dominate slot 1 but are rare overall. This suggests the AI puts "obvious" planets first and "thematic" planets (JUPITER, URANUS) in slots 2-3.

### Planet bonus hit rate
- **75.7% of headlines** got the planet bonus (165/218)
- This is very high — suggests the bonus is too easy to achieve

---

## 6. Connection System

### Connection classification (by AI)
| Type | Count | % |
|---|---|---|
| OTHERS (connected to other players) | 185 | 84.9% |
| NONE (no connection found) | 19 | 8.7% |
| SELF (only connected to own headlines) | 14 | 6.4% |

**Self-connection is essentially dead:** Only 14 out of 218 headlines were classified as self-only connections. Score contribution = 0 across the board. Removing self-connection scoring makes sense.

### Connection strength (across all 654 individual links)
| Strength | Count | % |
|---|---|---|
| STRONG | 363 | 55.5% |
| WEAK | 291 | 44.5% |

### Link sources (who was linked to)
| Source | STRONG | WEAK | Total |
|---|---|---|---|
| OTHER_PLAYER | 254 | 209 | 463 (70.8%) |
| ARCHIVE | 52 | 56 | 108 (16.5%) |
| SELF | 57 | 26 | 83 (12.7%) |

### Unique authors in linked headlines per submission
| Other Authors | Self Links | Count | % |
|---|---|---|---|
| 3 others, 0 self | 0 | 89 | 40.8% |
| 2 others, 0 self | 0 | 47 | 21.6% |
| 2 others, 1 self | 1 | 46 | 21.1% |
| 1 other, 2 self | 2 | 14 | 6.4% |
| 1 other, 0 self | 0 | 11 | 5.0% |
| 1 other, 1 self | 1 | 6 | 2.8% |
| 0 matched | 0 | 4 | 1.8% |
| 0 others, 3 self | 3 | 1 | 0.5% |

**For the proposed scoring (1/4/9 by unique other authors):**
- 3 unique other authors: 89 headlines (40.8%) → would get 9 pts
- 2 unique other authors: 93 headlines (42.7%) → would get 4 pts
- 1 unique other author: 31 headlines (14.2%) → would get 1 pt
- 0 other authors: 5 headlines (2.3%) → would get 0 pts

---

## 7. Headline Rewriting (5-band system)

### Band selection distribution
| Band | Count | % | Avg Dice Roll |
|---|---|---|---|
| 1 (most faithful) | 34 | 15.6% | 6.6 |
| 2 | 66 | 30.3% | 26.1 |
| 3 (middle) | 82 | 37.6% | 58.2 |
| 4 | 23 | 10.6% | 89.0 |
| 5 (most creative) | 13 | 6.0% | 97.7 |

**100% of headlines were rewritten** — no player submission matched the AI-selected band headline verbatim. Band 3 (middle ground) is most common, which is the intended design sweet spot.

---

## 8. Proposed Scoring Impact Analysis

### Current scoring: Base(5) + Plaus(0-2) + Self(0-1) + Others(0-3) + Planet(0-3) = max 14
### Proposed: Base(1) + Plaus(0-2) + Others(0/1/4/9) + Planet(0-2) = max 14

| Player | Current | New Est.* | Change |
|---|---|---|---|
| netrunner | 290 | ~196 | -32% |
| Brian G | 135 | ~82 | -39% |

*Rough estimate — exact depends on per-headline author counts.

**Effect of Base 5→1:** Total baseline across all players drops from 1,090 to 218 pts. This removes 872 "free" points from the game, making skill-based components (connections, plausibility) matter much more.

**Effect of Others 3→(1/4/9):** Players who connect to diverse authors get massively rewarded. The 40.8% of headlines connecting to 3 authors would jump from 3pts to 9pts each.

---

## Summary of Key Findings

1. **Baseline dominance** — 45.4% of all points are guaranteed baseline. Reducing to 1 is justified.
2. **Self-connection is dead** — 0 total self-connection points scored. Safe to remove.
3. **Planet imbalance** — JUPITER/URANUS are 3x more common than EARTH/VENUS. Need weighted tally or target distribution.
4. **Planet bonus too easy** — 75.7% hit rate. Reducing from 3→2 is reasonable.
5. **Connection diversity exists** — 40.8% linked to 3 unique authors, 42.7% to 2. The 1/4/9 system would reward this well.
6. **Quantity drives ranking** — Top scorer had most headlines. Base reduction + connection rewards would shift meta toward quality.
7. **Cooldown timing** — Median gap 79s with 60s cooldown. Players submit fast. Increasing cooldown to 90s wouldn't lose many submissions.
8. **Rewriting works** — 100% of headlines were player-modified from AI suggestions. The 5-band system is functioning.
