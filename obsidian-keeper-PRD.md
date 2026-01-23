# Product Requirements Document: Metis - Obsidian Vault Organizer

## Overview
Metis is an n8n workflow that automatically organizes, enriches metadata, and files notes in an Obsidian vault based on content analysis using LLM processing. Named after the Greek goddess of wisdom and deep thought, Metis handles multiple note types including meetings, technical documentation, drafts, research, templates, concepts, and system metadata.

## Problem Statement
Josh's Obsidian vault contains diverse note types with:
- Inconsistent or missing frontmatter metadata
- Notes in incorrect folder locations
- Mixed content types requiring different organizational schemes
- Placeholder transcript fields never filled
- Technical notes, drafts, and research mixed with meeting notes
- Manual organization burden preventing consistent note-taking

## Solution
Automated single-pass workflow that:
1. **Reads configuration** from a config note for dynamic context (attendees, clients, partners)
2. **Scans vault structure** to discover existing folders for intelligent routing
3. **Analyzes content** with a unified LLM prompt for type detection + metadata extraction
4. **Updates frontmatter** with type-specific schemas and extracted tags
5. **Moves files** to appropriate folders based on note type
6. **Tags low-confidence items** for manual review
7. **Generates verbose logs** with per-file details and statistics

---

## Technical Architecture

### System Components
1. **n8n workflow engine** - orchestration
2. **Obsidian Local REST API** - file read/write interface  
3. **Ollama (Qwen 2.5 14B Instruct)** - local LLM for content analysis
4. **Metis-Config.md** - dynamic configuration note in vault

### Key Design Decisions

#### Single-Pass LLM Architecture
We chose a unified single-pass approach over a two-pass (type detection → type-specific analysis) architecture:

**Trade-offs:**
- ✅ Simpler workflow with fewer nodes and no branching complexity
- ✅ Faster processing (one LLM call per file vs two)
- ✅ Easier to maintain and debug
- ❌ Larger prompt size (includes all type instructions)
- ❌ Less specialized per-type prompts

**Rationale:** The simplified architecture proved more reliable in practice. The unified prompt handles type detection and extraction well, and the reduced complexity eliminates entire classes of data-flow bugs.

#### Context Learning
The workflow dynamically learns context at runtime:
1. **Config Note** (`Metis-Config.md`): Contains attendees, known clients by location, partners, and routing rules
2. **Vault Structure Scan**: Discovers existing 1:1 folders, client folders, partner folders, and team folders

This allows the LLM to make better routing decisions and recognize entities without hardcoding.

#### Smart Skip Logic
Files are skipped if:
- `status: processed` in frontmatter AND
- `last_processed` timestamp >= `updated` timestamp (file unchanged since last processing)

This requires an Obsidian plugin (Linter or Update Time) to maintain the `updated` field automatically.

### Data Flow
```
Trigger (Webhook/Cron)
  ↓
┌─────────────────────────────────────┐
│ CONTEXT GATHERING (parallel)        │
│  → Read Metis-Config.md             │
│  → Scan Vault Structure             │
│  → Merge & Store Context            │
└─────────────────────────────────────┘
  ↓
Find all .md files in Work/ directory
  ↓
For each file:
  → Read content via REST API
  → Parse existing frontmatter
  → Check skip conditions (unchanged since last process)
  ↓
If not skipped:
  → Build unified LLM prompt (with context)
  → LLM: Detect type + extract metadata + determine folder
  → Parse LLM response
  ↓
Route by needs_manual_review flag:
  → TRUE:  Tag for review, write back, preserve data
  → FALSE: Update frontmatter, write back, check if move needed
  ↓
If needs_move:
  → Write to new location
  → Delete old file
  ↓
Merge all results
  ↓
Generate verbose summary log (markdown tables)
  ↓
Webhook response
```

---

## Note Type Taxonomy

### Supported Note Types

| Type | Description | Folder Pattern |
|------|-------------|----------------|
| `meeting` | Time-bound discussions | Varies by meeting_type |
| `technical-note` | Code, architecture, infrastructure | `Work/Knowledge/Technical/{category}/` |
| `draft` | Work-in-progress communications | `Work/Drafts/{draft_type}s/` |
| `research` | Analysis, industry intel | `Work/Knowledge/{category}/` |
| `template` | Reusable structures | `Work/Templates/{template_type}s/` |
| `meta` | System logs, configuration | `Work/Meta/{meta_type}s/` |
| `concept` | Ideas, brainstorming | `Work/Projects/{project}/Concepts/` or `Work/Knowledge/Product/Features/` |

### Meeting Subtypes & Routing

| Meeting Type | Folder Pattern |
|--------------|----------------|
| `1on1` | `Work/Areas/One on One Meetings/{person}/` |
| `customer` (known) | `Work/Projects/Active Deals/Clients/{location}/{client}/` |
| `customer` (prospect) | `Work/Projects/Active Deals/New Prospects/{location}/` |
| `partner` | `Work/Projects/Active Deals/Partners/{partner}/` |
| `internal` | `Work/Areas/Expedient Teams/{team}/` |

---

## Configuration

### Metis-Config.md Structure

Located at `Work/Meta/Configuration/Metis-Config.md`:

```markdown
---
type: meta
meta_type: configuration
system: metis
---

# Metis Configuration

## Attendee Context (Expedient Team)
- Rob McCafferty (manager)
- David Determan, Patrick Rosenberger, Keith Cadieux (direct reports)
- [... team members ...]

## Known Clients by Location

### Boston
- AAA, Bluestone Bank, Chase Corp, [...]

### Denver
- AGC Bio, DMSi, [...]

[... other locations ...]

## Known Partners
- Pure Storage, VMware, Nutanix, EchoStor, [...]

## Folder Routing Rules

### Meeting Notes
- 1on1 meetings → `Work/Areas/One on One Meetings/{person}/`
- Customer meetings (known) → `Work/Projects/Active Deals/Clients/{location}/{client}/`
- Customer meetings (prospect) → `Work/Projects/Active Deals/New Prospects/{location}/`
[...]
```

### Environment Configuration

| Setting | Value |
|---------|-------|
| Obsidian API URL | `http://100.111.39.118:27123` (Tailscale) |
| Vault Root | `/Users/joshdavis/Library/Mobile Documents/iCloud~md~obsidian/Documents/dvsobs1` |
| LLM | Ollama - `qwen2.5:14b-instruct` |
| Temperature | 0.1 (deterministic) |
| Schedule | Daily at 2:00 AM (`0 2 * * *`) |

---

## Functional Requirements

### FR-1: Context Gathering
**Description:** Read configuration and scan vault structure before processing files

**Components:**
1. **Read Config Note** - HTTP GET `Metis-Config.md`
2. **Scan Vault Structure** - Recursive directory listing to discover:
   - Existing 1:1 folders (people)
   - Existing client folders by location
   - Existing partner folders
   - Existing team folders

**Output:** Context object with:
```javascript
{
  attendees: string,      // Parsed attendee section
  clients: string,        // Parsed clients section  
  partners: string,       // Parsed partners section
  routing_rules: string,  // Parsed routing rules
  discovered_people: [],  // From vault scan
  discovered_clients: {}, // By location
  discovered_partners: [],
  discovered_teams: []
}
```

---

### FR-2: File Discovery
**Description:** Identify markdown files requiring processing

**Implementation:** Recursive vault API listing starting from `Work/`

**Exclusions:**
- `Dashboard.md`
- `Metis-Log-*.md`
- `Janitor-Log-*.md`
- `Metis-Config.md`

**Limit:** 10 files per run (for testing; remove for production)

---

### FR-3: Smart Skip Logic
**Description:** Skip files that haven't changed since last processing

**Conditions to skip:**
- `frontmatter.status === 'processed'` AND
- `frontmatter.last_processed >= frontmatter.updated`

**Skip reasons:**
- `unchanged` - File not modified since last processing
- `already_processed` - No timestamps to compare, but status is processed

**Dependency:** Requires Obsidian Linter plugin configured to update `updated` field on save.

---

### FR-4: Unified LLM Analysis
**Description:** Single prompt for type detection and metadata extraction

**Prompt Structure:**
```
You are analyzing an Obsidian note. First determine its type, then extract type-specific metadata.

FILE PATH: {relative_path}
FRONTMATTER: {existing frontmatter}
CONTENT PREVIEW: {first 500 chars}
FULL CONTENT: {full content}

=== CONTEXT FROM CONFIG ===
{attendee context}
{client context}
{partner context}

=== DISCOVERED VAULT STRUCTURE ===
EXISTING 1:1 FOLDERS: {discovered people}
EXISTING PARTNER FOLDERS: {discovered partners}
EXISTING CLIENT FOLDERS BY LOCATION: {discovered clients}

=== STEP 1: TYPE DETECTION ===
[Type definitions and signals]

=== STEP 2: TYPE-SPECIFIC EXTRACTION ===
[Per-type field requirements and folder routing rules]

=== OUTPUT FORMAT ===
Return ONLY valid JSON with note_type, type-specific fields, correct_folder, confidence, needs_manual_review
```

**Expected Output:**
```json
{
  "note_type": "meeting|technical-note|draft|research|template|meta|concept",
  "type_confidence": "high|medium|low",
  "type_reasoning": "Brief explanation",
  "meeting_type": "1on1|customer|partner|internal",
  "person": "Name (for 1on1)",
  "client": "Company (for customer)",
  "location": "City",
  "attendees": "Name1, Name2",
  "summary": "Brief summary",
  "action_items": ["Action 1", "Action 2"],
  "correct_folder": "Work/Areas/One on One Meetings/Rob McCafferty/",
  "confidence": "high|medium|low",
  "needs_manual_review": false
}
```

---

### FR-5: Tag Extraction
**Description:** Extract tags from LLM-generated content and merge into frontmatter

**Process:**
1. Parse `#Relevant Additional Tags:` line from body (if present)
2. Extract individual tags (strip `#` prefix)
3. Merge with existing frontmatter tags array
4. Remove the artifact line from body

**Example:**
```
# Body contains:
#Relevant Additional Tags: #Azure, #StorageCosts, #PerformanceAnalysis

# Frontmatter becomes:
tags: [Azure, StorageCosts, PerformanceAnalysis]

# Line removed from body
```

---

### FR-6: Frontmatter Update
**Description:** Rebuild frontmatter with type-specific schema

**Common fields:**
- `type`: Note type
- `created`: Original creation date (preserved)
- `status`: `processed` or `needs-manual-review`
- `last_processed`: Current date (YYYY-MM-DD)
- `tags`: Merged tag array

**Type-specific fields:** Varies by note type (see Appendix A)

---

### FR-7: File Movement
**Description:** Move files to correct folders via REST API

**Process:**
1. Compare `current_folder` with `correct_folder` from LLM
2. If different: 
   - Write updated content to new location (PUT creates folders implicitly)
   - Delete original file

**Note:** Obsidian REST API automatically creates parent directories when PUTting to a new path.

---

### FR-8: Manual Review Tagging
**Description:** Mark low-confidence files for human review

**Trigger conditions:**
- `analysis.needs_manual_review === true`
- `analysis.confidence === "low"`
- `type_confidence === "low"`

**Actions:**
- Set `status: needs-manual-review`
- Add `needs-manual-review` to tags array
- Do NOT move file

---

### FR-9: Verbose Logging
**Description:** Generate detailed processing report

**Log location:** `Work/Meta/Logs/Metis-Log-{YYYY-MM-DD}.md`

**Format:**
```markdown
# Metis Log - {timestamp}

## Summary

| Metric | Count |
|--------|-------|
| Total Processed | 10 |
| Updated Successfully | 7 |
| Files Moved | 2 |
| Flagged for Review | 3 |
| Errors | 0 |

## By Type

| Type | Count |
|------|-------|
| meeting | 4 |
| research | 3 |
| technical-note | 2 |
| concept | 1 |

---

## Updated Successfully

| File | Type | Confidence | Folder |
|------|------|------------|--------|
| [[Meeting Note.md]] | meeting | high | Work/Areas/One on One/Rob/ |
| [[Analysis.md]] | research | high | Work/Knowledge/Business/ |

## Flagged for Manual Review

| File | Type | Confidence | Reason |
|------|------|------------|--------|
| [[Untitled.md]] | concept | low | Unable to determine note type |

## Files Moved

| File | From | To |
|------|------|----|
| [[Meeting.md]] | Work/00-Inbox/ | Work/Areas/One on One/Rob/ |

---
*Generated by Metis at {timestamp}*
```

---

## n8n Workflow Structure

### Node Inventory

| # | Node Name | Type | Purpose |
|---|-----------|------|---------|
| 1 | Webhook Trigger | webhook | Manual execution |
| 2 | Nightly Cron (2am) | scheduleTrigger | Scheduled execution |
| 3 | Read Config Note | httpRequest | GET Metis-Config.md |
| 4 | Scan Vault Structure | code | Recursive directory listing |
| 5 | Merge Context Inputs | merge | Combine config + structure |
| 6 | Store Context | code | Parse and store context object |
| 7 | Find All MD Files | code | List all markdown files |
| 8 | Read File Content | httpRequest | GET file content |
| 9 | Parse Frontmatter | code | Extract YAML, check skip |
| 10 | Skip Already Processed? | if | Route skipped files |
| 11 | Build LLM Prompt | code | Construct unified prompt |
| 12 | LLM Analyze Note | ollama | Qwen analysis |
| 13 | Parse LLM Response | code | Extract JSON from response |
| 14 | Needs Manual Review? | if | Route by confidence |
| 15 | Update Frontmatter | code | Rebuild frontmatter (OK path) |
| 16 | Tag for Manual Review | code | Add review tags (review path) |
| 17 | Write Updated Content | httpRequest | PUT updated file |
| 18 | Write Review Tag | httpRequest | PUT review-tagged file |
| 19 | Preserve Update Data | code | Maintain data after HTTP |
| 20 | Preserve Review Data | code | Maintain data after HTTP |
| 21 | Needs Move? | if | Check folder difference |
| 22 | Prepare File Move | code | Calculate new path |
| 23 | Write File to New Location | httpRequest | PUT to new path |
| 24 | Delete Old File | httpRequest | DELETE original |
| 25 | Preserve Move Data | code | Maintain data after HTTP |
| 26 | Merge All Results | merge | Combine all paths |
| 27 | Build Summary Log | code | Generate verbose log |
| 28 | Write Log File | httpRequest | PUT log to vault |
| 29 | Webhook Response | respondToWebhook | Return stats |

### Data Flow Diagram

```
[Webhook] ──┬──→ [Read Config] ────────┬──→ [Merge Context] → [Store Context]
[Cron]   ──┘                           │                           ↓
            └──→ [Scan Structure] ─────┘                    [Find MD Files]
                                                                   ↓
                                                           [Read Content]
                                                                   ↓
                                                         [Parse Frontmatter]
                                                                   ↓
                                                      [Skip Already Processed?]
                                                         ↓ YES         ↓ NO
                                                    [to Merge]   [Build Prompt]
                                                                       ↓
                                                               [LLM Analyze]
                                                                       ↓
                                                            [Parse Response]
                                                                       ↓
                                                        [Needs Manual Review?]
                                                          ↓ YES         ↓ NO
                                                    [Tag Review]  [Update FM]
                                                          ↓             ↓
                                                    [Write Tag]   [Write Content]
                                                          ↓             ↓
                                                   [Preserve]    [Preserve]
                                                          ↓             ↓
                                                          │       [Needs Move?]
                                                          │        ↓ YES    ↓ NO
                                                          │   [Move Flow]   │
                                                          │        ↓        │
                                                          └──→ [Merge All] ←┘
                                                                   ↓
                                                            [Build Log]
                                                                   ↓
                                                            [Write Log]
                                                                   ↓
                                                          [Webhook Response]
```

---

## Obsidian Plugin Requirements

### Required: Linter Plugin
**Purpose:** Automatically update `updated` frontmatter field on save

**Configuration:**
1. Install "Linter" from Community Plugins
2. Enable "YAML Timestamp" rule
3. Configure:
   - Date Modified Key: `updated`
   - Format: `YYYY-MM-DD`
   - Force update on save: enabled

### Alternative: Update Time on Edit Plugin
Simpler plugin that only handles the `updated` timestamp.

---

## Testing & Reset

### Reset Script
To clear Metis-related frontmatter for re-testing:

```javascript
// Removes: status, last_processed, needs-manual-review tag
// From all files in Work/
```

Run via: `node reset-notes.js`

### Test Checklist
- [ ] Config note readable
- [ ] Vault structure scanned correctly
- [ ] Skip logic working (unchanged files skipped)
- [ ] Type detection accurate
- [ ] Folder routing correct
- [ ] Tags extracted to frontmatter
- [ ] Verbose log generated
- [ ] Manual review tagging works

---

## Appendix A: Frontmatter Schemas

### Meeting Note
```yaml
---
type: meeting
created: 2026-01-20
date: 2026-01-20
meeting_type: 1on1|customer|partner|internal
person: Rob McCafferty          # if 1on1
client: Phia                    # if customer
location: Boston                # if customer
partner: EchoStor               # if partner
team: Sales Teams               # if internal
attendees: Rob McCafferty, Josh Davis
summary: Q1 planning discussion
project: unclassified
tags: [quarterly-planning]
status: processed
last_processed: 2026-01-23
---
```

### Technical Note
```yaml
---
type: technical-note
created: 2026-01-20
category: architecture|code|infrastructure|research
technologies: [Docker, n8n, Python]
summary: Vault automation architecture
tags: [automation, n8n]
status: processed
last_processed: 2026-01-23
---
```

### Draft
```yaml
---
type: draft
created: 2026-01-20
draft_type: communication|document|presentation
title: Q1 Strategy Proposal
summary: AI strategy proposal for leadership
tags: [strategy, proposal]
status: draft
last_processed: 2026-01-23
---
```

### Research
```yaml
---
type: research
created: 2026-01-20
category: technical|business|product
topic: DRaaS Market Analysis
summary: Competitive analysis of DRaaS vendors
tags: [draas, competitive-intel]
status: processed
last_processed: 2026-01-23
---
```

### Template
```yaml
---
type: template
created: 2026-01-20
template_type: automation|document|prompt
use_case: Meeting note template
tags: [template]
status: processed
last_processed: 2026-01-23
---
```

### Meta
```yaml
---
type: meta
created: 2026-01-20
meta_type: log|automation|configuration
system: metis
tags: [system]
status: processed
last_processed: 2026-01-23
---
```

### Concept
```yaml
---
type: concept
created: 2026-01-20
title: Automated RFP Response System
maturity: idea|exploration|proposed|validated
summary: AI-powered RFP response generation
tags: [idea, automation]
status: processed
last_processed: 2026-01-23
---
```

---

## Document History
- **v3.0** - 2026-01-23 - Rewrote to reflect actual implementation (single-pass, context learning, smart skip, tag extraction)
- **v2.0** - 2025-01-20 - Added multi-type support with two-pass architecture (superseded)
- **v1.0** - 2025-01-20 - Initial PRD (meeting notes only)
- **Workflow Name:** Metis
- **Author:** Josh Davis + Claude
- **Status:** Implemented
