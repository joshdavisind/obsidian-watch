# Product Requirements Document: Obsidian Vault Janitor

## Overview
An n8n workflow that automatically organizes, enriches metadata, and files notes in an Obsidian vault based on content analysis using LLM processing.

## Problem Statement
Josh's Obsidian vault contains meeting notes with:
- Inconsistent or missing frontmatter metadata
- Notes in incorrect folder locations
- Placeholder transcript fields never filled
- Manual organization burden preventing consistent note-taking

## Solution
Automated workflow that scans vault files, uses LLM to extract metadata and determine correct filing location, updates frontmatter, and moves files to appropriate folders.

---

## Technical Architecture

### System Components
1. **n8n workflow engine** - orchestration
2. **Obsidian Local REST API** - file read/write interface
3. **LLM (Claude Sonnet or Qwen)** - content analysis and metadata extraction
4. **File system operations** - folder creation and file movement

### Data Flow
```
Trigger (Webhook/Cron)
  ↓
Find all .md files in Work/ directory
  ↓
For each file:
  → Read content via REST API
  → Parse existing frontmatter
  → Send to LLM for analysis
  → Update frontmatter with extracted metadata
  → Determine correct folder location
  → Move file if needed
  → Tag for manual review if confidence is low
  ↓
Generate summary log
```

---

## Functional Requirements

### FR-1: File Discovery
**Description:** Identify all markdown files in Work/ directory requiring processing

**Acceptance Criteria:**
- Recursively scan `/Users/joshdavis/Library/Mobile Documents/iCloud~md~obsidian/Documents/dvsobs1/Work/`
- Include all `.md` files
- Exclude `Dashboard.md` files
- Exclude `Janitor-Log-*.md` files
- Return array of absolute file paths

**Implementation:**
```bash
find '/Users/joshdavis/Library/Mobile Documents/iCloud~md~obsidian/Documents/dvsobs1/Work' -name '*.md' -type f ! -name 'Dashboard.md' ! -name 'Janitor-Log-*'
```

---

### FR-2: File Content Reading
**Description:** Retrieve file content from Obsidian via REST API

**API Endpoint:**
- Base URL: `http://localhost:27124`
- Method: `GET`
- Path: `/vault/{encoded_relative_path}`
- Auth: `Authorization: Bearer 4931ee13bc3472b907f251ce39d7b4229a4f7fc360c0ab8f52213329671a7b12`

**Acceptance Criteria:**
- Convert absolute path to relative path (remove vault root prefix)
- URL-encode the relative path
- Parse response JSON containing file content
- Handle API errors gracefully

**Example:**
```
File: /Users/joshdavis/.../dvsobs1/Work/Projects/Active Deals/Clients/Denver/note.md
Relative: Work/Projects/Active Deals/Clients/Denver/note.md
Encoded: Work%2FProjects%2FActive%20Deals%2FClients%2FDenver%2Fnote.md
URL: http://localhost:27124/vault/Work%2FProjects%2FActive%20Deals%2FClients%2FDenver%2Fnote.md
```

---

### FR-3: Frontmatter Parsing
**Description:** Extract YAML frontmatter from markdown file content

**Input:** Raw markdown file content string

**Output:** 
```javascript
{
  filepath: string,           // absolute path
  filename: string,           // just filename with extension
  current_folder: string,     // absolute directory path
  frontmatter: object,        // parsed YAML as key-value pairs
  content: string,            // full file content
  has_frontmatter: boolean    // whether frontmatter exists
}
```

**Parsing Logic:**
- Frontmatter is enclosed between `---` delimiters at file start
- Parse each line as `key: value`
- Handle multi-line values
- Return empty object if no frontmatter found

**Example:**
```markdown
---
date: 2025-01-07
type: meeting
person: David Determan
---
# Meeting content
```
→ 
```javascript
{
  frontmatter: {
    date: "2025-01-07",
    type: "meeting",
    person: "David Determan"
  }
}
```

---

### FR-4: LLM Analysis
**Description:** Extract metadata and determine correct file location using LLM

**Input to LLM:**
```
You are analyzing an Obsidian note to extract metadata and determine its correct location.

CURRENT FILE PATH: {filepath}
CURRENT FRONTMATTER: {frontmatter_json}
CONTENT:
{full_content}

Extract and return ONLY a JSON object with this structure:
{
  "meeting_type": "1on1|customer|partner|internal|unknown",
  "person": "Full Name (for 1on1s only)",
  "client": "Company Name (for customer meetings)",
  "location": "Boston|Denver|Milwaukee|Indianapolis|Cincinnati|Phoenix|Louisville",
  "attendees": "Name1, Name2, Name3",
  "summary": "Brief summary of meeting",
  "action_items": ["Action 1", "Action 2"],
  "key_topics": ["Topic 1", "Topic 2"],
  "correct_folder": "Work/Areas/One on One Meetings/{person}/" or "Work/Projects/Active Deals/Clients/{location}/{client}/",
  "confidence": "high|medium|low",
  "needs_manual_review": true|false
}

FOLDER ROUTING RULES:
- 1on1 meetings → Work/Areas/One on One Meetings/{person}/
- Customer meetings → Work/Projects/Active Deals/Clients/{location}/{client}/
- Partner meetings → Work/Projects/Active Deals/Partners/{partner}/
- Internal team meetings → Work/Areas/Expedient Teams/{team}/
- Unknown/low confidence → needs_manual_review: true

ATTENDEE CONTEXT (people at Expedient):
- Rob McCafferty (manager)
- David Determan, Patrick Rosenberger, Keith Cadieux (direct reports)
- Ben Gallo, Brian Lacombe, Chad St. Thomas, David Saliba, Jacob Figueroa, Jason Molitor, Aaron Littlejohn
- Jeff Fertitta, Anthony Jackman, Duane Weber, Bob Carter, Kate Rance

KNOWN CLIENTS BY LOCATION:
Boston: AAA, Bluestone Bank, Chase Corp, City Brewing, DFCU, Element Fleet Management, Fiduciary Trust, Flower City, GW&K, Hawkes Learning, Logitech, Medwiz, Metropolitan Opera, Phia, St. Mary's Bank, Tricon, U Mass Med, United Way CT

Denver: AGC Bio, City and County of Denver, DMSi, Pursuit Collective

Milwaukee: Arhaus, Aspirus, Badger Color, BDO, Duly Healthcare, Falcon Plastics, ITASKA, Medline, Messer Cutting, The Mutual Group

Indianapolis: Aces Power, Byrider, FCFCU, Ford Meter Box, Graham Packaging, Heartland Dental, Indiana Interactive, Ivy Tech, KELMAR, Republic Airways, Rural King

Cincinnati: MCC Label, US Urology

Phoenix: Brinks Home Security, City of Avondale, Conagra Brands, Moxa, New England Health Plan, PacketWatch, Sonora Quest, Test Equity, Thryv, Tractor Supply

Louisville: Lifespring

If you see these names, it's likely an internal or 1on1 meeting.

Return ONLY the JSON object, no markdown formatting, no explanation.
```

**Expected Output Schema:**
```typescript
interface LLMAnalysis {
  meeting_type: "1on1" | "customer" | "partner" | "internal" | "unknown";
  person?: string;           // Required if meeting_type === "1on1"
  client?: string;           // Required if meeting_type === "customer"
  location?: string;         // Required if meeting_type === "customer"
  partner?: string;          // Required if meeting_type === "partner"
  team?: string;            // Required if meeting_type === "internal"
  attendees: string;        // Comma-separated list
  summary: string;
  action_items: string[];
  key_topics: string[];
  correct_folder: string;   // Full relative path from vault root
  confidence: "high" | "medium" | "low";
  needs_manual_review: boolean;
}
```

**Confidence Heuristics:**
- **High:** Clear meeting type, known attendees, explicit topic
- **Medium:** Inferred meeting type, partial attendee info
- **Low:** Minimal content, unclear context, conflicting signals

**Manual Review Triggers:**
- Confidence is "low"
- Cannot determine meeting_type
- Missing required fields (person for 1on1, client+location for customer)
- Content is too short (<50 characters)
- Contradictory information

---

### FR-5: Frontmatter Update
**Description:** Rebuild frontmatter block with extracted metadata

**Input:**
- Original file content
- LLM analysis object
- Existing frontmatter

**Output:** Updated markdown content with new frontmatter

**Frontmatter Schema:**
```yaml
---
date: YYYY-MM-DD              # Preserve existing or use file creation date
type: meeting                 # Always "meeting"
meeting_type: string          # From LLM
person: string                # From LLM (if 1on1)
client: string                # From LLM (if customer)
location: string              # From LLM (if customer)
partner: string               # From LLM (if partner)
team: string                  # From LLM (if internal)
attendees: string             # From LLM
summary: string               # From LLM
project: string               # Preserve existing or "unclassified"
status: processed             # Set to "processed" after update
---
```

**Content Enhancements:**
If sections don't exist in content, append:

```markdown
## Action Items
- [ ] {action_item_1}
- [ ] {action_item_2}

## Key Topics
- {topic_1}
- {topic_2}
```

**Acceptance Criteria:**
- Replace existing frontmatter block (between first `---` and second `---`)
- Preserve all content after frontmatter
- Add action items only if not already present
- Add key topics only if not already present
- Maintain markdown formatting

---

### FR-6: File Movement
**Description:** Move files to correct folder locations based on LLM analysis

**Preconditions:**
- LLM analysis has `correct_folder` path
- Current file location differs from `correct_folder`
- File has been updated with new frontmatter

**Process:**
1. Create target directory if it doesn't exist
2. Move file to target directory with same filename
3. Handle name collisions (append timestamp if needed)

**Folder Creation:**
```bash
mkdir -p '/Users/joshdavis/Library/Mobile Documents/iCloud~md~obsidian/Documents/dvsobs1/{correct_folder}'
```

**File Move:**
```bash
mv '{source_path}' '/Users/joshdavis/Library/Mobile Documents/iCloud~md~obsidian/Documents/dvsobs1/{correct_folder}/{filename}'
```

**Acceptance Criteria:**
- Target folder exists before move
- File successfully relocated
- Original file removed from source
- Handle errors (permissions, disk space, etc.)

---

### FR-7: Manual Review Tagging
**Description:** Mark files requiring manual review

**Trigger Conditions:**
- `LLM analysis.needs_manual_review === true`
- LLM confidence is "low"
- LLM fails to determine correct_folder

**Actions:**
1. Update frontmatter: `status: needs-manual-review`
2. Append tag to tags field: `#needs-manual-review`
3. Do NOT move file
4. Write updated content back to original location

**Example:**
```yaml
---
date: 2024-10-22
type: meeting
status: needs-manual-review
tags: [[🗓️ Meetings MOC]] #needs-manual-review
---
```

---

### FR-8: Summary Logging
**Description:** Generate processing report after each run

**Log Location:** 
`/Users/joshdavis/Library/Mobile Documents/iCloud~md~obsidian/Documents/dvsobs1/Work/00-Inbox/Janitor-Log-{YYYY-MM-DD}.md`

**Log Format:**
```markdown
# Vault Janitor Log - {ISO_TIMESTAMP}

## Summary
- **Total files processed:** {count}
- **Metadata updated:** {count}
- **Files moved:** {count}
- **Needs manual review:** {count}

## Files Needing Review
- [[{filename}]] - {confidence} confidence
- [[{filename}]] - {confidence} confidence

## Files Moved
- [[{filename}]] → {new_folder_path}
- [[{filename}]] → {new_folder_path}

## Errors (if any)
- [[{filename}]] - {error_message}
```

**Acceptance Criteria:**
- One log file per day (append if run multiple times same day)
- Include statistics summary
- List all files requiring manual review
- List all file movements
- Log any errors encountered
- Use Obsidian wiki-link format for filenames

---

### FR-9: Webhook Trigger
**Description:** Allow manual execution via HTTP webhook

**Endpoint:** `/webhook/vault-janitor`
**Method:** POST
**Authentication:** None (internal n8n endpoint)

**Response:**
```json
{
  "success": true,
  "message": "Vault janitor completed",
  "log_path": "/path/to/Janitor-Log-2025-01-20.md",
  "stats": {
    "total": 42,
    "updated": 38,
    "moved": 15,
    "needs_review": 4
  }
}
```

---

### FR-10: Scheduled Execution
**Description:** Run automatically on schedule

**Schedule:** Daily at 2:00 AM local time
**Cron Expression:** `0 2 * * *`

**Behavior:**
- Identical to webhook trigger
- No response required (runs silently)
- Logs written to Obsidian vault

---

## Non-Functional Requirements

### NFR-1: Performance
- Process files in parallel where possible (n8n batch processing)
- Target: <2 seconds per file (LLM call is bottleneck)
- Handle vaults with up to 1000 files

### NFR-2: Reliability
- Gracefully handle API failures (REST API down, LLM timeout)
- Retry failed operations (max 3 attempts)
- Never delete files - only move/update
- Atomic operations (don't leave half-updated files)

### NFR-3: Error Handling
- Log all errors to summary log
- Continue processing remaining files if one fails
- Mark failed files for manual review
- Include error context in logs

### NFR-4: Data Safety
- Never overwrite files without reading first
- Preserve original frontmatter fields not being updated
- Backup strategy not required (Obsidian has version history)
- Idempotent operations (safe to run multiple times)

---

## Data Model

### File Object (Internal State)
```typescript
interface FileObject {
  filepath: string;              // Absolute path
  filename: string;              // Filename only
  current_folder: string;        // Current directory
  frontmatter: Record<string, any>;
  content: string;               // Full markdown content
  has_frontmatter: boolean;
  analysis?: LLMAnalysis;
  updated_content?: string;      // After frontmatter update
  needs_update: boolean;
  needs_move: boolean;
  error?: string;
}
```

### Log Entry
```typescript
interface LogEntry {
  timestamp: string;             // ISO 8601
  total_processed: number;
  metadata_updated: number;
  files_moved: number;
  needs_review: number;
  review_files: {
    filename: string;
    confidence: string;
  }[];
  moved_files: {
    filename: string;
    from: string;
    to: string;
  }[];
  errors: {
    filename: string;
    error: string;
  }[];
}
```

---

## Implementation Notes

### n8n Workflow Architecture

**Decision: Single Workflow**
This system uses a single n8n workflow to handle all processing steps. This approach:
- Keeps the tightly-coupled sequential pipeline in one place
- Simplifies error handling and result aggregation
- Allows both webhook and cron triggers to share the same logic
- Makes debugging and maintenance easier

**Alternative Consideration:** Multiple workflows could be used if components need to be reused elsewhere, but the current design doesn't require this separation.

### n8n Workflow Structure

**Nodes (in order):**
1. **Webhook Trigger** - Manual execution endpoint
2. **Cron Trigger** - Scheduled execution (2am daily)
3. **Find All MD Files** - Execute Command node (bash `find`)
4. **Split File Paths** - Code node (split stdout into array)
5. **Read File Content** - HTTP Request node (Obsidian API GET)
6. **Parse Frontmatter** - Code node (regex + string parsing)
7. **Build LLM Prompt** - Set node (construct prompt string)
8. **LLM Analysis** - AI node (Claude/Qwen - REPLACE THIS)
9. **Parse LLM Response** - Code node (JSON.parse with error handling)
10. **Needs Manual Review?** - IF node (check confidence/flags)
    - **TRUE branch:** Tag for Manual Review → Write Review Tag → Merge
    - **FALSE branch:** Update Frontmatter → Write Updated Content → Needs Move? IF
11. **Needs Move?** - IF node (check if location differs)
    - **TRUE branch:** Create Target Folder → Move File → Merge
    - **FALSE branch:** Merge
12. **Merge All Results** - Merge node (combine all branches)
13. **Build Summary Log** - Code node (aggregate stats)
14. **Write Log File** - Execute Command node (write to file)
15. **Webhook Response** - Return JSON response

### Critical Code Snippets

**Frontmatter Parsing (Node 6):**
```javascript
const content = $json.content || '';
const filepath = $input.item.json.filepath;

// Extract frontmatter
const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
let frontmatter = {};
if (fmMatch) {
  const fmText = fmMatch[1];
  fmText.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      frontmatter[key.trim()] = valueParts.join(':').trim();
    }
  });
}

return {
  json: {
    filepath,
    filename: filepath.split('/').pop(),
    current_folder: filepath.substring(0, filepath.lastIndexOf('/')),
    frontmatter,
    content,
    has_frontmatter: !!fmMatch
  }
};
```

**Frontmatter Update (Node 10):**
```javascript
const data = $json;
const fm = data.frontmatter;
const analysis = data.analysis;

// Build updated frontmatter
const updated = {
  date: fm.date || new Date().toISOString().split('T')[0],
  type: 'meeting',
  meeting_type: analysis.meeting_type,
  person: analysis.person || '',
  client: analysis.client || '',
  location: analysis.location || '',
  attendees: analysis.attendees || '',
  summary: analysis.summary || '',
  project: fm.project || 'unclassified',
  status: 'processed'
};

// Build new frontmatter block
const fmLines = Object.entries(updated)
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n');

const newFrontmatter = `---\n${fmLines}\n---`;

// Replace old frontmatter in content
let newContent = data.content.replace(/^---[\s\S]*?---/, newFrontmatter);

// Add action items if not present
if (!newContent.includes('## Action Items') && analysis.action_items?.length) {
  const items = analysis.action_items.map(item => `- [ ] ${item}`).join('\n');
  newContent += `\n\n## Action Items\n${items}`;
}

// Add key topics if not present
if (!newContent.includes('## Key Topics') && analysis.key_topics?.length) {
  const topics = analysis.key_topics.map(t => `- ${t}`).join('\n');
  newContent += `\n\n## Key Topics\n${topics}`;
}

return {
  json: {
    ...data,
    updated_content: newContent
  }
};
```

**Summary Log Builder (Node 13):**
```javascript
const items = $input.all();
const timestamp = new Date().toISOString();
const date = timestamp.split('T')[0];

const stats = {
  total: items.length,
  updated: items.filter(i => i.json.needs_update).length,
  moved: items.filter(i => i.json.needs_move).length,
  needs_review: items.filter(i => i.json.analysis?.needs_manual_review).length
};

const log = `# Vault Janitor Log - ${timestamp}

## Summary
- **Total files processed:** ${stats.total}
- **Metadata updated:** ${stats.updated}
- **Files moved:** ${stats.moved}
- **Needs manual review:** ${stats.needs_review}

## Files Needing Review
${items.filter(i => i.json.analysis?.needs_manual_review)
  .map(i => `- [[${i.json.filename}]] - ${i.json.analysis.confidence} confidence`)
  .join('\n') || 'None'}

## Files Moved
${items.filter(i => i.json.needs_move)
  .map(i => `- [[${i.json.filename}]] → ${i.json.analysis.correct_folder}`)
  .join('\n') || 'None'}
`;

return {
  json: {
    log_content: log,
    log_path: `/Users/joshdavis/Library/Mobile Documents/iCloud~md~obsidian/Documents/dvsobs1/Work/00-Inbox/Janitor-Log-${date}.md`
  }
};
```

---

## Configuration

### Environment Variables
```bash
OBSIDIAN_API_URL=http://localhost:27124
OBSIDIAN_API_KEY=4931ee13bc3472b907f251ce39d7b4229a4f7fc360c0ab8f52213329671a7b12
VAULT_ROOT=/Users/joshdavis/Library/Mobile Documents/iCloud~md~obsidian/Documents/dvsobs1
```

### n8n Credentials
**Name:** Obsidian Local REST API  
**Type:** HTTP Header Auth  
**Header Name:** Authorization  
**Header Value:** `Bearer 4931ee13bc3472b907f251ce39d7b4229a4f7fc360c0ab8f52213329671a7b12`

---

## Testing Strategy

### Unit Tests
- Frontmatter parsing with various formats
- LLM response parsing with malformed JSON
- Path encoding/decoding
- Folder path determination logic

### Integration Tests
1. **Test with 5 sample files:**
   - 1 well-formed 1on1 note
   - 1 customer meeting note
   - 1 note with missing metadata
   - 1 note with no frontmatter
   - 1 note requiring manual review

2. **Verify:**
   - Files moved to correct locations
   - Frontmatter properly updated
   - Manual review tags applied correctly
   - Summary log generated
   - No data loss

### Edge Cases
- File with no content
- File with malformed YAML
- File already in correct location
- LLM returns invalid JSON
- REST API unavailable
- Folder name with special characters
- Duplicate filenames in target folder

---

## Future Enhancements

### Phase 2 (Not in Current Scope)
- iOS Shortcut integration for Krisp transcript capture
- Email forwarding integration
- Real-time processing (watch for new files)
- Batch undo functionality
- Web UI for manual review queue
- Support for non-meeting note types (projects, reference docs)
- Integration with Obsidian Dataview queries

---

## Success Metrics
- **Automation Rate:** % of notes filed automatically vs manual review
- **Accuracy:** % of files correctly categorized (validate sample set)
- **Time Savings:** Estimated hours saved per week
- **Vault Health:** Reduction in notes in Inbox folder over time

**Target Goals:**
- 80%+ automatic filing rate
- 95%+ accuracy on high-confidence categorizations
- Process entire vault (<500 files) in <20 minutes

---

## Dependencies
- n8n (v1.0+)
- Obsidian with Local REST API plugin enabled
- LLM API access (Claude Sonnet 4 or Qwen)
- macOS file system access
- Node.js runtime (for n8n)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| LLM misclassifies meeting type | Medium | Manual review tags for low confidence |
| REST API failures | High | Retry logic, error logging |
| File corruption during move | High | Obsidian version history, no overwrites |
| LLM cost overruns | Low | Batch processing, use Haiku for simple files |
| Network issues (iCloud sync) | Medium | Run during stable connection, queue retries |

---

## Appendix A: Folder Structure Reference

```
Work/
├── 00-Inbox/                    # Landing zone
├── Daily/                       # Daily notes
├── Archives/                    # Old/completed items
├── Areas/                       # Ongoing areas of responsibility
│   ├── Expedient Teams/
│   │   ├── Sales Teams/
│   │   │   ├── Denver/
│   │   │   └── Milwaukee/
│   │   └── Technical Strategy Leadership/
│   └── One on One Meetings/
│       ├── Aaron Littlejohn/
│       ├── Ben Gallo/
│       ├── David Determan/
│       ├── David Saliba/
│       ├── Jacob Figueroa/
│       ├── Patrick Rosenberger/
│       └── Rob McCafferty/
└── Projects/
    └── Active Deals/
        ├── Clients/
        │   ├── Boston/
        │   ├── Cincinnati/
        │   ├── Denver/
        │   ├── Indianapolis/
        │   ├── Louisville/
        │   ├── Milwaukee/
        │   └── Phoenix/
        └── Partners/
            └── EchoStor/
```

---

## Appendix B: Sample Note Transformations

### Before Processing:
```markdown
---
LLM-tagged: 2025-04-15T18:17:04.717Z
---

# [[2025-01-07 Determan and Davis Sync - Strategic Deals Discussion]]

Summary: This document contains the meeting transcript...

---

---
date: 2025-01-07
type: meeting
project: unclassifiedProject
summary: 
project_url:
---

tags: [[🗓️ Meetings MOC]],
Date: [[2025-01-07-11:01]]

# [[2025-01-07 Determan and Davis Sync]]

Strategic Deals
1. DMSi
2. AGC Bio (L7)

### Transcript
<details>
insert transcript
</details>
```

### After Processing:
```markdown
---
date: 2025-01-07
type: meeting
meeting_type: 1on1
person: David Determan
attendees: David Determan, Josh Davis
summary: Strategic deals discussion covering DMSi and AGC Bio partnerships
project: unclassified
status: processed
---

tags: [[🗓️ Meetings MOC]]
Date: [[2025-01-07-11:01]]

# [[2025-01-07 Determan and Davis Sync]]

Strategic Deals
1. DMSi
2. AGC Bio (L7)

## Key Topics
- DMSi partnership strategy
- AGC Bio L7 engagement

## Action Items
- [ ] Follow up on DMSi partnership details
- [ ] Schedule next discussion on AGC Bio

### Transcript
<details>
insert transcript
</details>
```

**File moved to:** `Work/Areas/One on One Meetings/David Determan/2025-01-07 Determan and Davis Sync.md`

---

## Document History
- **v1.0** - 2025-01-20 - Initial PRD
- **Author:** Claude (Anthropic)
- **Stakeholder:** Josh Davis
- **Status:** Ready for Implementation