# Product Requirements Document: Obsidian Vault Janitor v2.0

## Overview
An n8n workflow that automatically organizes, enriches metadata, and files notes in an Obsidian vault based on content analysis using two-pass LLM processing. The system handles multiple note types including meetings, technical documentation, drafts, research, templates, concepts, and system metadata.

## Problem Statement
Josh's Obsidian vault contains diverse note types with:
- Inconsistent or missing frontmatter metadata
- Notes in incorrect folder locations
- Mixed content types requiring different organizational schemes
- Placeholder transcript fields never filled
- Technical notes, drafts, and research mixed with meeting notes
- Manual organization burden preventing consistent note-taking

## Solution
Automated two-pass workflow that:
1. **Pass 1:** Determines note type through LLM analysis
2. **Pass 2:** Performs type-specific metadata extraction and folder routing
3. Updates frontmatter with extracted metadata
4. Moves files to appropriate folders based on note type
5. Tags low-confidence items for manual review

---

## Technical Architecture

### System Components
1. **n8n workflow engine** - orchestration
2. **Obsidian Local REST API** - file read/write interface
3. **LLM (Claude Sonnet or Qwen)** - two-pass content analysis and metadata extraction
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
  ↓
PASS 1: Type Detection
  → LLM determines note type (meeting|technical-note|draft|research|template|meta|concept)
  ↓
PASS 2: Type-Specific Analysis (route by type)
  → Meeting: Extract attendees, action items, determine 1on1 vs customer
  → Technical: Extract technologies, category, related projects
  → Draft: Extract recipient, purpose, draft type
  → Research: Extract topic, sources, category
  → Template: Extract variables, use case, version
  → Meta: Extract system type, automation context
  → Concept: Extract maturity, stakeholders, related project
  ↓
Actions:
  → Update frontmatter with type-specific schema
  → Determine correct folder location
  → Move file if needed
  → Tag for manual review if confidence is low
  ↓
Generate summary log
```

---

## Note Type Taxonomy

### Supported Note Types

#### 1. Meeting Notes (`meeting`)
**Description:** Time-bound discussions between people

**Subtypes:**
- `1on1`: One-on-one meetings
- `customer`: Client/prospect meetings
- `partner`: Partner/vendor meetings
- `internal`: Team/internal meetings

**Detection Signals:**
- Names of people in content
- Words: "discussed", "action items", "next steps", "meeting"
- Date-specific content
- Attendee lists

**Folder Routing:**
- 1on1 → `Work/Areas/One on One Meetings/{person}/`
- Customer → `Work/Projects/Active Deals/Clients/{location}/{client}/`
- Partner → `Work/Projects/Active Deals/Partners/{partner}/`
- Internal → `Work/Areas/Expedient Teams/{team}/`

---

#### 2. Technical Notes (`technical-note`)
**Description:** Technical content, architecture, code, infrastructure documentation

**Categories:**
- `architecture`: Design decisions, system patterns, trade-offs
- `code`: Snippets, examples, scripts, how-tos
- `infrastructure`: DevOps, deployment, monitoring, networking
- `research`: Technical deep-dives, evaluations, POCs

**Detection Signals:**
- Code blocks (especially 3+)
- Technical terminology: API, database, architecture, deployment
- Tags: #architecture, #code, #infrastructure, #devops
- System diagrams, technical diagrams

**Folder Routing:**
- Architecture → `Work/Knowledge/Technical/Architecture/`
- Code → `Work/Knowledge/Technical/Code/`
- Infrastructure → `Work/Knowledge/Technical/Infrastructure/`
- Research → `Work/Knowledge/Technical/Research/`

---

#### 3. Drafts (`draft`)
**Description:** Work-in-progress communications or documents

**Draft Types:**
- `communication`: Emails, Slack messages, announcements
- `document`: PRDs, proposals, reports, one-pagers
- `presentation`: Slide outlines, talking points

**Detection Signals:**
- "Draft" in title
- Incomplete sections, placeholder text
- Tags: #draft, #email-draft, #proposal
- Intended recipient mentioned
- "Subject:" or "To:" headers

**Folder Routing:**
- Communication → `Work/Drafts/Communications/`
- Document → `Work/Drafts/Documents/`
- Presentation → `Work/Drafts/Presentations/`

---

#### 4. Research (`research`)
**Description:** Curated information, analysis, industry/competitor intelligence

**Categories:**
- `technical`: Tech evaluations, architecture research
- `business`: Industry analysis, competitive intel, market trends
- `product`: Feature research, user insights, product comparisons

**Detection Signals:**
- Long-form content (>500 words)
- Multiple external links or citations
- Tags: #research, #analysis, #competitive-intel
- Comparative analysis language
- Source attributions

**Folder Routing:**
- Technical → `Work/Knowledge/Technical/Research/`
- Business (Competitor) → `Work/Knowledge/Business/Competitors/`
- Business (Industry) → `Work/Knowledge/Business/Industry Analysis/`
- Product → `Work/Knowledge/Product/`

---

#### 5. Templates (`template`)
**Description:** Reusable structures with placeholders

**Template Types:**
- `automation`: n8n configs, workflow templates, scripts
- `document`: PRD templates, one-pagers, standard documents
- `prompt`: LLM prompts, agent definitions

**Detection Signals:**
- Filename starts with "Template"
- Contains placeholder variables: `{variable_name}`, `[TBD]`, `<placeholder>`
- Generic/abstract content
- Tags: #template, #automation, #prompt

**Folder Routing:**
- Automation → `Work/Templates/Automation/`
- Prompt → `Work/Templates/Prompts/`
- Document → `Work/Templates/Documents/`

---

#### 6. Meta (`meta`)
**Description:** System/vault management, automation logs, configuration

**Meta Types:**
- `log`: Processing logs, janitor logs, system logs
- `automation`: Workflow metadata, automation documentation
- `configuration`: Vault settings, conventions, system config

**Detection Signals:**
- Filename: "Janitor-Log", "Config", "System"
- Tags: #automation, #system, #config, #log
- Automation-related content
- Vault statistics, processing reports

**Folder Routing:**
- Log → `Work/Meta/Logs/`
- Automation → `Work/Meta/Automation/`
- Configuration → `Work/Meta/Configuration/`

---

#### 7. Concepts (`concept`)
**Description:** Exploratory ideas, brainstorming, early-stage thinking

**Maturity Levels:**
- `idea`: Initial thought, unvalidated
- `exploration`: Actively investigating
- `proposed`: Formal proposal stage
- `validated`: Tested/approved, ready for execution

**Detection Signals:**
- "Idea:", "Concept:", "What if" language
- Bullet-point brainstorming lists
- Speculative language
- Tags: #idea, #concept, #brainstorm
- Questions without answers

**Folder Routing:**
- With project → `Work/Projects/{related_project}/Concepts/`
- Product-related → `Work/Knowledge/Product/Features/`
- General → `Work/Drafts/Documents/`

---

## Vault Folder Structure

```
Work/
├── 00-Inbox/                    # All new notes land here first
├── Daily/                       # Daily logs
├── Archives/                    # Completed/old items
│
├── Areas/                       # Ongoing areas of responsibility
│   ├── Expedient Teams/
│   │   ├── Sales Teams/
│   │   │   ├── Denver/
│   │   │   └── Milwaukee/
│   │   └── Technical Strategy Leadership/
│   └── One on One Meetings/
│       ├── Aaron Littlejohn/
│       ├── Ben Gallo/
│       ├── Brian Lacombe/
│       ├── Chad St. Thomas/
│       ├── David Determan/
│       ├── David Saliba/
│       ├── Jacob Figueroa/
│       ├── Jason Molitor/
│       ├── Patrick Rosenberger/
│       └── Rob McCafferty/
│
├── Projects/                    # Active deals & initiatives
│   ├── Active Deals/
│   │   ├── Clients/
│   │   │   ├── Boston/
│   │   │   │   ├── AAA/
│   │   │   │   ├── Bluestone Bank/
│   │   │   │   ├── Element Fleet Management/
│   │   │   │   └── [other clients...]
│   │   │   ├── Cincinnati/
│   │   │   ├── Denver/
│   │   │   ├── Indianapolis/
│   │   │   ├── Louisville/
│   │   │   ├── Milwaukee/
│   │   │   └── Phoenix/
│   │   └── Partners/
│   │       └── EchoStor/
│   ├── AI CTRL/
│   │   └── Concepts/           # Project-specific concepts
│   ├── Discovery Templates/
│   └── Special Presentations/
│
├── Knowledge/                   # Reference & learning (NEW)
│   ├── Technical/
│   │   ├── Architecture/       # Design decisions, patterns
│   │   ├── Code/              # Snippets, examples, scripts
│   │   ├── Infrastructure/    # DevOps, systems, tools
│   │   └── Research/          # Technical deep-dives
│   ├── Business/
│   │   ├── Industry Analysis/ # Market research, trends
│   │   ├── Competitors/       # Competitive intelligence
│   │   └── Best Practices/    # Process, methodologies
│   └── Product/
│       ├── Features/          # Product ideas, specs
│       └── User Research/     # Customer insights
│
├── Drafts/                      # Work in progress (NEW)
│   ├── Communications/         # Emails, messages, posts
│   ├── Documents/             # Reports, proposals, PRDs
│   └── Presentations/         # Slide content, outlines
│
├── Templates/                   # Reusable structures (NEW)
│   ├── Automation/            # n8n configs, scripts
│   ├── Documents/             # PRD templates, one-pagers
│   └── Prompts/               # LLM prompts, agents
│
└── Meta/                        # System/vault management (NEW)
    ├── Automation/             # Workflow metadata
    ├── Logs/                  # Janitor logs, processing records
    └── Configuration/         # Vault settings, conventions
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

### FR-4: Type Detection (Pass 1)
**Description:** Determine primary note type through LLM analysis

**Input to LLM:**
```
You are analyzing an Obsidian note to determine its type and extract metadata.

CURRENT FILE PATH: {filepath}
CURRENT FRONTMATTER: {frontmatter}
CONTENT PREVIEW (first 500 chars):
{content.substring(0, 500)}

FULL CONTENT:
{content}

First, determine the note type by analyzing:
- Content structure and length
- Presence of code blocks, links, or media
- Tone (meeting notes vs reference vs draft)
- Explicit type indicators in title or content

Return ONLY a JSON object:
{
  "note_type": "meeting|technical-note|draft|research|template|meta|concept",
  "confidence": "high|medium|low",
  "reasoning": "Brief explanation of type determination"
}

TYPE DEFINITIONS:

**meeting**: Contains discussion of a conversation between people, has attendees, date-specific
  - Signals: Names of people, "discussed", "action items", "next steps"

**technical-note**: Technical content, architecture, code, infrastructure
  - Signals: Code blocks, technical terminology, system diagrams, API references

**draft**: Work-in-progress communication or document
  - Signals: "Draft" in title, incomplete sections, placeholder text, intended recipient

**research**: Curated information, analysis, industry/competitor intel
  - Signals: Multiple external links, citations, comparative analysis, >500 words

**template**: Reusable structure with placeholders
  - Signals: "Template" in filename, variables like {variable_name}, generic content

**meta**: System/vault management, automation logs, configuration
  - Signals: "Janitor-Log", "Config", automation-related, vault statistics

**concept**: Exploratory ideas, brainstorming, early-stage thinking
  - Signals: "Idea:", "Concept:", bullet-point lists, speculative language

DETECTION EXAMPLES:

Meeting Note:
"Rob and I discussed the Phia opportunity..."
→ note_type: "meeting"

Technical Note:
"```python\ndef process_data():\n..."
→ note_type: "technical-note"

Draft:
"Subject: Q1 Roadmap Proposal\nHi Team,\n[TBD: Add context]"
→ note_type: "draft"

Research:
"Analysis of top 5 DRaaS providers:\n1. Veeam - market leader...\n[15 citations]"
→ note_type: "research"

Template:
"# Meeting Note - {client_name}\nDate: {date}\n## Attendees\n{attendees}"
→ note_type: "template"

Meta:
"# Vault Janitor Log - 2025-01-20\nTotal files processed: 42..."
→ note_type: "meta"

Concept:
"Idea: What if we automated discovery calls using AI to pre-fill RFP responses?"
→ note_type: "concept"

Choose the MOST SPECIFIC type that applies. If unclear, use "concept" or set confidence to "low".

Return ONLY valid JSON, no markdown formatting, no explanation.
```

**Expected Output Schema:**
```typescript
interface TypeDetection {
  note_type: "meeting" | "technical-note" | "draft" | "research" | "template" | "meta" | "concept";
  confidence: "high" | "medium" | "low";
  reasoning: string;
}
```

**Acceptance Criteria:**
- Correctly identifies note type with >85% accuracy (measured on test set)
- Returns valid JSON
- Provides reasoning for type determination
- Sets confidence appropriately based on signal clarity

---

### FR-5: Type-Specific Analysis (Pass 2)

Each note type routes to its own specialized analysis prompt.

#### FR-5.1: Meeting Analysis

**Input to LLM:**
```
PASS 2: Meeting Note Analysis

CONTENT: {content}

Extract meeting metadata and return ONLY a JSON object:
{
  "meeting_type": "1on1|customer|partner|internal|unknown",
  "person": "Full Name (for 1on1s only)",
  "client": "Company Name (for customer meetings)",
  "location": "Boston|Denver|Milwaukee|Indianapolis|Cincinnati|Phoenix|Louisville",
  "partner": "Partner Name (for partner meetings)",
  "team": "Team Name (for internal meetings)",
  "attendees": "Name1, Name2, Name3",
  "summary": "Brief summary of meeting",
  "action_items": ["Action 1", "Action 2"],
  "key_topics": ["Topic 1", "Topic 2"],
  "correct_folder": "Full path where file should live",
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

Return ONLY valid JSON, no markdown formatting, no explanation.
```

**Frontmatter Schema:**
```yaml
---
date: YYYY-MM-DD
type: meeting
meeting_type: 1on1|customer|partner|internal
person: string               # Required if meeting_type === "1on1"
client: string               # Required if meeting_type === "customer"
location: string             # Required if meeting_type === "customer"
partner: string              # Required if meeting_type === "partner"
team: string                # Required if meeting_type === "internal"
attendees: string           # Comma-separated
summary: string
project: string             # Preserve existing or "unclassified"
status: processed
---
```

---

#### FR-5.2: Technical Note Analysis

**Input to LLM:**
```
PASS 2: Technical Note Analysis

CONTENT: {content}

Extract technical metadata and return ONLY a JSON object:
{
  "category": "architecture|code|infrastructure|research",
  "technologies": ["Python", "Docker", "AWS"],
  "related_projects": ["AI CTRL"],
  "summary": "Brief technical summary",
  "correct_folder": "Work/Knowledge/Technical/{category}/",
  "confidence": "high|medium|low",
  "needs_manual_review": false
}

CATEGORY RULES:
- architecture: Design decisions, system patterns, trade-offs, architecture diagrams
- code: Snippets, examples, scripts, how-tos, implementation details
- infrastructure: DevOps, deployment, monitoring, networking, system administration
- research: Deep-dives, evaluations, POCs, technical investigations

Return ONLY valid JSON, no markdown formatting, no explanation.
```

**Frontmatter Schema:**
```yaml
---
type: technical-note
category: architecture|code|infrastructure|research
technologies: [Docker, Kubernetes, Python]
related_projects: [AI CTRL]
summary: string
status: draft|active|archived
created: YYYY-MM-DD
updated: YYYY-MM-DD
---
```

---

#### FR-5.3: Draft Analysis

**Input to LLM:**
```
PASS 2: Draft Analysis

CONTENT: {content}

Extract draft metadata and return ONLY a JSON object:
{
  "draft_type": "communication|document|presentation",
  "recipient": ["David Determan", "Rob McCafferty"],
  "purpose": "proposal|update|request|fyi",
  "title": "Meaningful title of the draft",
  "summary": "Brief purpose",
  "correct_folder": "Work/Drafts/{draft_type}s/",
  "confidence": "high|medium|low",
  "needs_manual_review": false
}

DRAFT TYPE RULES:
- communication: Emails, Slack messages, announcements, memos
- document: PRDs, proposals, reports, one-pagers, strategy docs
- presentation: Slide outlines, talking points, presentation scripts

Return ONLY valid JSON, no markdown formatting, no explanation.
```

**Frontmatter Schema:**
```yaml
---
type: draft
draft_type: communication|document|presentation
recipient: [Name1, Name2]
purpose: proposal|update|request|fyi
title: string
summary: string
status: draft|review|final
created: YYYY-MM-DD
send_by: YYYY-MM-DD       # Optional deadline
---
```

---

#### FR-5.4: Research Analysis

**Input to LLM:**
```
PASS 2: Research Analysis

CONTENT: {content}

Extract research metadata and return ONLY a JSON object:
{
  "topic": "Main research topic",
  "category": "technical|business|product",
  "subcategory": "competitors|industry-analysis|feature|evaluation",
  "sources": ["url1", "url2"],
  "related_to": ["Active Deal - Phia"],
  "summary": "Key findings",
  "correct_folder": "Work/Knowledge/{category}/{subcategory}/",
  "confidence": "high|medium|low",
  "needs_manual_review": false
}

CATEGORY RULES:
- technical: Tech evaluations, architecture research, vendor comparisons
  → Folder: Work/Knowledge/Technical/Research/
  
- business: Industry analysis, competitive intel, market trends
  - competitors → Work/Knowledge/Business/Competitors/
  - industry analysis → Work/Knowledge/Business/Industry Analysis/
  - best practices → Work/Knowledge/Business/Best Practices/
  
- product: Feature research, user insights, product comparisons
  → Folder: Work/Knowledge/Product/

Return ONLY valid JSON, no markdown formatting, no explanation.
```

**Frontmatter Schema:**
```yaml
---
type: research
topic: string
category: technical|business|product
subcategory: string
sources: [url1, url2]
related_to: [Project/Deal names]
summary: string
status: in-progress|complete
created: YYYY-MM-DD
---
```

---

#### FR-5.5: Template Analysis

**Input to LLM:**
```
PASS 2: Template Analysis

CONTENT: {content}

Extract template metadata and return ONLY a JSON object:
{
  "template_type": "automation|document|prompt",
  "use_case": "Description of what this template is for",
  "variables": ["client_name", "date", "attendees"],
  "summary": "Brief description",
  "correct_folder": "Work/Templates/{template_type}s/",
  "confidence": "high|medium|low",
  "needs_manual_review": false
}

TEMPLATE TYPE RULES:
- automation: n8n workflows, scripts, workflow configs
- prompt: LLM prompts, agent definitions, system prompts
- document: PRD templates, meeting note templates, standard documents

Return ONLY valid JSON, no markdown formatting, no explanation.
```

**Frontmatter Schema:**
```yaml
---
type: template
template_type: automation|document|prompt
use_case: string
variables: [var1, var2]
version: string
updated: YYYY-MM-DD
---
```

---

#### FR-5.6: Meta Analysis

**Input to LLM:**
```
PASS 2: Meta Note Analysis

CONTENT: {content}

Extract meta metadata and return ONLY a JSON object:
{
  "meta_type": "log|automation|configuration",
  "system": "vault-janitor|n8n|obsidian",
  "summary": "Brief description",
  "correct_folder": "Work/Meta/{meta_type}s/",
  "confidence": "high|medium|low",
  "needs_manual_review": false
}

META TYPE RULES:
- log: Processing logs, janitor logs, system logs
- automation: Workflow metadata, automation documentation
- configuration: Vault settings, conventions, system config

Return ONLY valid JSON, no markdown formatting, no explanation.
```

**Frontmatter Schema:**
```yaml
---
type: meta
meta_type: log|automation|configuration
system: string
created: YYYY-MM-DD
---
```

---

#### FR-5.7: Concept Analysis

**Input to LLM:**
```
PASS 2: Concept Analysis

CONTENT: {content}

Extract concept metadata and return ONLY a JSON object:
{
  "title": "Concept title",
  "maturity": "idea|exploration|proposed|validated",
  "related_project": "AI CTRL",
  "stakeholders": ["Jeff Fertitta", "Rob McCafferty"],
  "summary": "Concept summary",
  "correct_folder": "Work/Projects/{related_project}/Concepts/" or "Work/Knowledge/Product/Features/",
  "confidence": "high|medium|low",
  "needs_manual_review": false
}

MATURITY LEVELS:
- idea: Initial thought, unvalidated
- exploration: Actively investigating
- proposed: Formal proposal stage
- validated: Tested/approved, ready for execution

FOLDER RULES:
- If related to specific project → Work/Projects/{project}/Concepts/
- If product-related → Work/Knowledge/Product/Features/
- Otherwise → Work/Drafts/Documents/

Return ONLY valid JSON, no markdown formatting, no explanation.
```

**Frontmatter Schema:**
```yaml
---
type: concept
title: string
maturity: idea|exploration|proposed|validated
related_project: string
stakeholders: [Name1, Name2]
summary: string
created: YYYY-MM-DD
---
```

---

### FR-6: Frontmatter Update
**Description:** Rebuild frontmatter block with extracted metadata based on note type

**Input:**
- Original file content
- Note type (from Pass 1)
- Type-specific analysis object (from Pass 2)
- Existing frontmatter

**Output:** Updated markdown content with new frontmatter

**Processing Logic:**

1. **Determine frontmatter schema based on note type**
2. **Merge existing frontmatter with new metadata** (preserve fields like `project`, dates)
3. **Build new frontmatter block**
4. **Replace old frontmatter in content**
5. **Add type-specific content sections if missing:**
   - Meeting: Action Items, Key Topics
   - Technical: Related Notes
   - Draft: Review Checklist
   - Research: Sources, Key Findings
   - Concept: Validation Criteria

**Example Implementation:**
```javascript
const data = $json;
const fm = data.frontmatter;
const analysis = data.analysis;
const noteType = data.note_type;

let updated = {};

// Base fields common to all types
updated.type = noteType;
updated.created = fm.created || fm.date || new Date().toISOString().split('T')[0];
updated.status = analysis.needs_manual_review ? 'needs-manual-review' : 'processed';

// Type-specific fields
switch(noteType) {
  case 'meeting':
    updated.date = fm.date || updated.created;
    updated.meeting_type = analysis.meeting_type;
    updated.person = analysis.person || '';
    updated.client = analysis.client || '';
    updated.location = analysis.location || '';
    updated.partner = analysis.partner || '';
    updated.team = analysis.team || '';
    updated.attendees = analysis.attendees || '';
    updated.summary = analysis.summary || '';
    updated.project = fm.project || 'unclassified';
    break;
    
  case 'technical-note':
    updated.category = analysis.category;
    updated.technologies = JSON.stringify(analysis.technologies || []);
    updated.related_projects = JSON.stringify(analysis.related_projects || []);
    updated.summary = analysis.summary || '';
    updated.updated = new Date().toISOString().split('T')[0];
    break;
    
  case 'draft':
    updated.draft_type = analysis.draft_type;
    updated.recipient = JSON.stringify(analysis.recipient || []);
    updated.purpose = analysis.purpose || '';
    updated.title = analysis.title || '';
    updated.summary = analysis.summary || '';
    updated.send_by = analysis.send_by || '';
    break;
    
  case 'research':
    updated.topic = analysis.topic || '';
    updated.category = analysis.category;
    updated.subcategory = analysis.subcategory || '';
    updated.sources = JSON.stringify(analysis.sources || []);
    updated.related_to = JSON.stringify(analysis.related_to || []);
    updated.summary = analysis.summary || '';
    break;
    
  case 'template':
    updated.template_type = analysis.template_type;
    updated.use_case = analysis.use_case || '';
    updated.variables = JSON.stringify(analysis.variables || []);
    updated.version = fm.version || '1.0';
    updated.updated = new Date().toISOString().split('T')[0];
    break;
    
  case 'meta':
    updated.meta_type = analysis.meta_type;
    updated.system = analysis.system || '';
    break;
    
  case 'concept':
    updated.title = analysis.title || '';
    updated.maturity = analysis.maturity || 'idea';
    updated.related_project = analysis.related_project || '';
    updated.stakeholders = JSON.stringify(analysis.stakeholders || []);
    updated.summary = analysis.summary || '';
    break;
}

// Build new frontmatter block
const fmLines = Object.entries(updated)
  .filter(([k, v]) => v !== '')
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n');

const newFrontmatter = `---\n${fmLines}\n---`;

// Replace old frontmatter
let newContent = data.content.replace(/^---[\s\S]*?---/, newFrontmatter);

// Add type-specific sections
if (noteType === 'meeting') {
  if (!newContent.includes('## Action Items') && analysis.action_items?.length) {
    const items = analysis.action_items.map(item => `- [ ] ${item}`).join('\n');
    newContent += `\n\n## Action Items\n${items}`;
  }
  if (!newContent.includes('## Key Topics') && analysis.key_topics?.length) {
    const topics = analysis.key_topics.map(t => `- ${t}`).join('\n');
    newContent += `\n\n## Key Topics\n${topics}`;
  }
}

return {
  json: {
    ...data,
    updated_content: newContent
  }
};
```

**Acceptance Criteria:**
- Frontmatter schema matches note type
- Existing important fields preserved (dates, project associations)
- Type-specific sections added where appropriate
- Valid YAML formatting
- No data loss

---

### FR-7: File Movement
**Description:** Move files to correct folder locations based on type-specific analysis

**Preconditions:**
- LLM analysis has `correct_folder` path
- Current file location differs from `correct_folder`
- File has been updated with new frontmatter
- Confidence is not "low" (unless manual override)

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

**Collision Handling:**
```javascript
// If file exists at target
if (fileExists(targetPath)) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const nameWithoutExt = filename.replace(/\.md$/, '');
  filename = `${nameWithoutExt}-${timestamp}.md`;
}
```

**Acceptance Criteria:**
- Target folder exists before move
- File successfully relocated
- Original file removed from source
- Collisions handled gracefully
- Handle errors (permissions, disk space, etc.)

---

### FR-8: Manual Review Tagging
**Description:** Mark files requiring manual review

**Trigger Conditions:**
- Pass 1: `confidence === "low"`
- Pass 2: `analysis.needs_manual_review === true`
- Pass 2: `analysis.confidence === "low"`
- LLM fails to determine correct_folder
- Multiple potential types detected
- Critical fields missing for routing

**Actions:**
1. Update frontmatter: `status: needs-manual-review`
2. Append tag to tags field: `#needs-manual-review`
3. Do NOT move file (leave in current location)
4. Write updated content back to original location
5. Log reason for manual review

**Example:**
```yaml
---
date: 2024-10-22
type: concept
status: needs-manual-review
tags: [[🗓️ Meetings MOC]] #needs-manual-review
manual_review_reason: Low confidence in type detection
---
```

**Acceptance Criteria:**
- Status clearly marked
- Tag added for Dataview queries
- File remains in original location
- Reason logged for user context

---

### FR-9: Summary Logging
**Description:** Generate processing report after each run

**Log Location:** 
`/Users/joshdavis/Library/Mobile Documents/iCloud~md~obsidian/Documents/dvsobs1/Work/Meta/Logs/Janitor-Log-{YYYY-MM-DD}.md`

**Log Format:**
```markdown
# Vault Janitor Log - {ISO_TIMESTAMP}

## Summary
- **Total files processed:** {count}
- **Metadata updated:** {count}
- **Files moved:** {count}
- **Needs manual review:** {count}

## Processing by Type
- **Meetings:** {count} ({meeting_type breakdown})
- **Technical Notes:** {count} ({category breakdown})
- **Drafts:** {count} ({draft_type breakdown})
- **Research:** {count}
- **Templates:** {count}
- **Meta:** {count}
- **Concepts:** {count}

## Files Needing Review
- [[{filename}]] - {reason} - {confidence} confidence
- [[{filename}]] - {reason} - {confidence} confidence

## Files Moved
- [[{filename}]] → {new_folder_path} ({note_type})
- [[{filename}]] → {new_folder_path} ({note_type})

## Type Changes Detected
- [[{filename}]] - Changed from {old_type} to {new_type}

## Errors (if any)
- [[{filename}]] - {error_message}

## Run Statistics
- **Start time:** {timestamp}
- **End time:** {timestamp}
- **Duration:** {seconds}s
- **Average processing time:** {seconds}s per file
```

**Acceptance Criteria:**
- One log file per day (append if run multiple times same day)
- Include comprehensive statistics
- Group by note type
- List all files requiring manual review with reasons
- List all file movements with type context
- Log any errors encountered
- Use Obsidian wiki-link format for filenames
- Track type changes (if existing type differs from detected type)

---

### FR-10: Webhook Trigger
**Description:** Allow manual execution via HTTP webhook

**Endpoint:** `/webhook/vault-janitor`
**Method:** POST
**Authentication:** None (internal n8n endpoint)

**Optional Parameters:**
```json
{
  "folder": "Work/00-Inbox",      // Limit to specific folder
  "note_type": "meeting",         // Only process specific type
  "dry_run": false                // Preview changes without executing
}
```

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
    "needs_review": 4,
    "by_type": {
      "meeting": 20,
      "technical-note": 10,
      "draft": 5,
      "research": 3,
      "template": 2,
      "meta": 1,
      "concept": 1
    }
  }
}
```

---

### FR-11: Scheduled Execution
**Description:** Run automatically on schedule

**Schedule:** Daily at 2:00 AM local time
**Cron Expression:** `0 2 * * *`

**Behavior:**
- Identical to webhook trigger
- No response required (runs silently)
- Logs written to Obsidian vault
- Email/Slack notification on errors only

---

## Non-Functional Requirements

### NFR-1: Performance
- Process files in parallel where possible (n8n batch processing)
- Target: <3 seconds per file average (2 LLM calls per file)
- Handle vaults with up to 1000 files
- Two-pass approach optimizes token usage (type detection uses minimal context)

### NFR-2: Reliability
- Gracefully handle API failures (REST API down, LLM timeout)
- Retry failed operations (max 3 attempts with exponential backoff)
- Never delete files - only move/update
- Atomic operations (don't leave half-updated files)
- Rollback capability (log original frontmatter before updates)

### NFR-3: Error Handling
- Log all errors to summary log with context
- Continue processing remaining files if one fails
- Mark failed files for manual review
- Include error context: stack trace, file path, operation attempted
- Separate error log for debugging

### NFR-4: Data Safety
- Never overwrite files without reading first
- Preserve original frontmatter fields not being updated
- Backup strategy not required (Obsidian has version history)
- Idempotent operations (safe to run multiple times)
- Log before/after state for audit trail

### NFR-5: Token Efficiency
- Pass 1 uses content preview (first 500 chars) + minimal context
- Pass 2 uses full content only for identified type
- Average token usage: ~2000 tokens per file (Pass 1: 800, Pass 2: 1200)
- Batch processing to minimize API overhead

---

## Data Model

### File Object (Internal State)
```typescript
interface FileObject {
  // Core identification
  filepath: string;              // Absolute path
  filename: string;              // Filename only
  current_folder: string;        // Current directory
  
  // Content
  frontmatter: Record<string, any>;
  content: string;               // Full markdown content
  has_frontmatter: boolean;
  
  // Pass 1: Type detection
  note_type?: NoteType;
  type_confidence?: "high" | "medium" | "low";
  type_reasoning?: string;
  
  // Pass 2: Type-specific analysis
  analysis?: MeetingAnalysis | TechnicalAnalysis | DraftAnalysis | ResearchAnalysis | TemplateAnalysis | MetaAnalysis | ConceptAnalysis;
  
  // Processing state
  updated_content?: string;      // After frontmatter update
  needs_update: boolean;
  needs_move: boolean;
  needs_manual_review: boolean;
  manual_review_reason?: string;
  
  // Metadata
  original_type?: string;        // If type changed
  processing_time?: number;      // Seconds
  error?: string;
}

type NoteType = "meeting" | "technical-note" | "draft" | "research" | "template" | "meta" | "concept";
```

### Type-Specific Analysis Interfaces

```typescript
interface MeetingAnalysis {
  meeting_type: "1on1" | "customer" | "partner" | "internal" | "unknown";
  person?: string;
  client?: string;
  location?: string;
  partner?: string;
  team?: string;
  attendees: string;
  summary: string;
  action_items: string[];
  key_topics: string[];
  correct_folder: string;
  confidence: "high" | "medium" | "low";
  needs_manual_review: boolean;
}

interface TechnicalAnalysis {
  category: "architecture" | "code" | "infrastructure" | "research";
  technologies: string[];
  related_projects: string[];
  summary: string;
  correct_folder: string;
  confidence: "high" | "medium" | "low";
  needs_manual_review: boolean;
}

interface DraftAnalysis {
  draft_type: "communication" | "document" | "presentation";
  recipient: string[];
  purpose: "proposal" | "update" | "request" | "fyi";
  title: string;
  summary: string;
  send_by?: string;
  correct_folder: string;
  confidence: "high" | "medium" | "low";
  needs_manual_review: boolean;
}

interface ResearchAnalysis {
  topic: string;
  category: "technical" | "business" | "product";
  subcategory?: string;
  sources: string[];
  related_to: string[];
  summary: string;
  correct_folder: string;
  confidence: "high" | "medium" | "low";
  needs_manual_review: boolean;
}

interface TemplateAnalysis {
  template_type: "automation" | "document" | "prompt";
  use_case: string;
  variables: string[];
  version?: string;
  correct_folder: string;
  confidence: "high" | "medium" | "low";
  needs_manual_review: boolean;
}

interface MetaAnalysis {
  meta_type: "log" | "automation" | "configuration";
  system: string;
  summary: string;
  correct_folder: string;
  confidence: "high" | "medium" | "low";
  needs_manual_review: boolean;
}

interface ConceptAnalysis {
  title: string;
  maturity: "idea" | "exploration" | "proposed" | "validated";
  related_project?: string;
  stakeholders: string[];
  summary: string;
  correct_folder: string;
  confidence: "high" | "medium" | "low";
  needs_manual_review: boolean;
}
```

### Log Entry
```typescript
interface LogEntry {
  timestamp: string;             // ISO 8601
  duration_seconds: number;
  
  // Counts
  total_processed: number;
  metadata_updated: number;
  files_moved: number;
  needs_review: number;
  
  // By type
  by_type: {
    meeting: number;
    technical_note: number;
    draft: number;
    research: number;
    template: number;
    meta: number;
    concept: number;
  };
  
  // Details
  review_files: {
    filename: string;
    reason: string;
    confidence: string;
  }[];
  
  moved_files: {
    filename: string;
    from: string;
    to: string;
    note_type: string;
  }[];
  
  type_changes: {
    filename: string;
    old_type: string;
    new_type: string;
  }[];
  
  errors: {
    filename: string;
    error: string;
    operation: string;
  }[];
  
  // Performance
  avg_processing_time: number;   // Seconds per file
  slowest_file: {
    filename: string;
    time: number;
  };
}
```

---

## Implementation Notes

### n8n Workflow Structure (Two-Pass)

**Nodes (in order):**

**Trigger & Discovery:**
1. **Webhook Trigger** - Manual execution endpoint
2. **Cron Trigger** - Scheduled execution (2am daily)
3. **Find All MD Files** - Execute Command node (bash `find`)
4. **Split File Paths** - Code node (split stdout into array)
5. **Read File Content** - HTTP Request node (Obsidian API GET)
6. **Parse Frontmatter** - Code node (regex + string parsing)

**Pass 1: Type Detection:**
7. **Build Type Detection Prompt** - Set node (construct Pass 1 prompt)
8. **LLM Type Detection** - AI node (YOUR LLM - Qwen/Sonnet)
9. **Parse Type Response** - Code node (JSON.parse with error handling)
10. **Route by Type** - Switch node (7 branches for each note type)

**Pass 2: Type-Specific Analysis (7 parallel branches):**

**Branch 1: Meeting**
11a. **Build Meeting Prompt** - Set node
12a. **LLM Meeting Analysis** - AI node
13a. **Parse Meeting Response** - Code node

**Branch 2: Technical**
11b. **Build Technical Prompt** - Set node
12b. **LLM Technical Analysis** - AI node
13b. **Parse Technical Response** - Code node

**Branch 3: Draft**
11c. **Build Draft Prompt** - Set node
12c. **LLM Draft Analysis** - AI node
13c. **Parse Draft Response** - Code node

**Branch 4: Research**
11d. **Build Research Prompt** - Set node
12d. **LLM Research Analysis** - AI node
13d. **Parse Research Response** - Code node

**Branch 5: Template**
11e. **Build Template Prompt** - Set node
12e. **LLM Template Analysis** - AI node
13e. **Parse Template Response** - Code node

**Branch 6: Meta**
11f. **Build Meta Prompt** - Set node
12f. **LLM Meta Analysis** - AI node
13f. **Parse Meta Response** - Code node

**Branch 7: Concept**
11g. **Build Concept Prompt** - Set node
12g. **LLM Concept Analysis** - AI node
13g. **Parse Concept Response** - Code node

**Merge & Processing:**
14. **Merge Type Analyses** - Merge node (combine all 7 branches)
15. **Needs Manual Review?** - IF node (check confidence/flags)
    - **TRUE branch:** Tag for Manual Review → Write Review Tag → Merge Final
    - **FALSE branch:** Update Frontmatter → Write Updated Content → Needs Move? IF
16. **Needs Move?** - IF node (check if location differs)
    - **TRUE branch:** Create Target Folder → Move File → Merge Final
    - **FALSE branch:** Merge Final

**Finalization:**
17. **Merge Final Results** - Merge node (combine all processing branches)
18. **Build Summary Log** - Code node (aggregate stats by type)
19. **Write Log File** - Execute Command node (write to Meta/Logs/)
20. **Webhook Response** - Return JSON response

---

### Critical Code Snippets

**Type Detection Prompt Builder (Node 7):**
```javascript
const data = $json;
const contentPreview = data.content.substring(0, 500);

const prompt = `You are analyzing an Obsidian note to determine its type.

CURRENT FILE PATH: ${data.filepath}
CURRENT FRONTMATTER: ${JSON.stringify(data.frontmatter)}
CONTENT PREVIEW (first 500 chars):
${contentPreview}

${data.content.length > 500 ? 'FULL CONTENT:\n' + data.content : ''}

[... rest of Pass 1 prompt from FR-4 ...]

Return ONLY valid JSON, no markdown formatting.`;

return {
  json: {
    ...data,
    type_detection_prompt: prompt
  }
};
```

**Type Router (Node 10):**
```javascript
// Switch node configuration
const noteType = $json.note_type;

// Route to appropriate branch
switch(noteType) {
  case 'meeting':
    return [0]; // Output 0
  case 'technical-note':
    return [1]; // Output 1
  case 'draft':
    return [2]; // Output 2
  case 'research':
    return [3]; // Output 3
  case 'template':
    return [4]; // Output 4
  case 'meta':
    return [5]; // Output 5
  case 'concept':
    return [6]; // Output 6
  default:
    return [6]; // Default to concept branch
}
```

**Frontmatter Update with Type Support (Node 15):**
```javascript
const data = $json;
const fm = data.frontmatter;
const analysis = data.analysis;
const noteType = data.note_type;

let updated = {};

// [Implementation from FR-6 above...]

// Build new frontmatter block
const fmLines = Object.entries(updated)
  .filter(([k, v]) => v !== '' && v !== null && v !== undefined)
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n');

const newFrontmatter = `---\n${fmLines}\n---`;

// Replace old frontmatter
let newContent = data.content.replace(/^---[\s\S]*?---/, newFrontmatter);

// Add type-specific sections
// [Type-specific content additions from FR-6...]

return {
  json: {
    ...data,
    updated_content: newContent,
    needs_update: true
  }
};
```

**Summary Log Builder with Type Breakdown (Node 18):**
```javascript
const items = $input.all();
const timestamp = new Date().toISOString();
const date = timestamp.split('T')[0];
const startTime = items[0]?.json?.start_time || timestamp;
const duration = (Date.parse(timestamp) - Date.parse(startTime)) / 1000;

// Count by type
const byType = {
  meeting: 0,
  'technical-note': 0,
  draft: 0,
  research: 0,
  template: 0,
  meta: 0,
  concept: 0
};

items.forEach(item => {
  const type = item.json.note_type;
  if (type && byType.hasOwnProperty(type)) {
    byType[type]++;
  }
});

// Detailed breakdowns
const meetingBreakdown = items
  .filter(i => i.json.note_type === 'meeting')
  .reduce((acc, i) => {
    const mt = i.json.analysis?.meeting_type || 'unknown';
    acc[mt] = (acc[mt] || 0) + 1;
    return acc;
  }, {});

const stats = {
  total: items.length,
  updated: items.filter(i => i.json.needs_update).length,
  moved: items.filter(i => i.json.needs_move).length,
  needs_review: items.filter(i => i.json.needs_manual_review).length
};

const log = `# Vault Janitor Log - ${timestamp}

## Summary
- **Total files processed:** ${stats.total}
- **Metadata updated:** ${stats.updated}
- **Files moved:** ${stats.moved}
- **Needs manual review:** ${stats.needs_review}

## Processing by Type
- **Meetings:** ${byType.meeting} (${Object.entries(meetingBreakdown).map(([k,v]) => `${k}: ${v}`).join(', ')})
- **Technical Notes:** ${byType['technical-note']}
- **Drafts:** ${byType.draft}
- **Research:** ${byType.research}
- **Templates:** ${byType.template}
- **Meta:** ${byType.meta}
- **Concepts:** ${byType.concept}

## Files Needing Review
${items.filter(i => i.json.needs_manual_review)
  .map(i => `- [[${i.json.filename}]] - ${i.json.manual_review_reason || 'Low confidence'} - ${i.json.analysis?.confidence || 'unknown'} confidence`)
  .join('\n') || 'None'}

## Files Moved
${items.filter(i => i.json.needs_move)
  .map(i => `- [[${i.json.filename}]] → ${i.json.analysis?.correct_folder} (${i.json.note_type})`)
  .join('\n') || 'None'}

## Type Changes Detected
${items.filter(i => i.json.original_type && i.json.original_type !== i.json.note_type)
  .map(i => `- [[${i.json.filename}]] - Changed from ${i.json.original_type} to ${i.json.note_type}`)
  .join('\n') || 'None'}

## Run Statistics
- **Start time:** ${startTime}
- **End time:** ${timestamp}
- **Duration:** ${duration.toFixed(2)}s
- **Average processing time:** ${(duration / stats.total).toFixed(2)}s per file
`;

return {
  json: {
    log_content: log,
    log_path: `/Users/joshdavis/Library/Mobile Documents/iCloud~md~obsidian/Documents/dvsobs1/Work/Meta/Logs/Janitor-Log-${date}.md`,
    stats: {
      ...stats,
      by_type: byType,
      duration_seconds: duration
    }
  }
};
```

---

## Edge Cases & Multi-Type Handling

### Multi-Type Notes
**Example:** Meeting note that includes substantial technical research

**Solution:** 
- **Primary type:** `meeting` (it's time-bound)
- **Add frontmatter field:**
  ```yaml
  contains: [technical-content]
  related_notes: [[Technical Deep-Dive on X]]
  ```
- **Optional enhancement (Phase 2):** Extract technical content into separate note

### Template Notes Being Customized
**Example:** "Template, Discovery Email.md" customized for specific client

**Solution:** 
- If in `Templates/` folder → `type: template`
- If being customized for specific use:
  - Copy to `Drafts/Communications/`
  - Set `type: draft`, `draft_type: communication`
  - Add `source_template: [[Template, Discovery Email]]`
- Original template stays as template

### Research Becoming Draft Document
**Lifecycle:**
1. **Start:** `type: research`, `status: in-progress` in `Knowledge/Business/`
2. **Mature:** Change `status: complete`
3. **Manual action:** Create new draft in `Drafts/Documents/`
4. **Link:** Add `source_research: [[Original Research]]` to draft
5. **Archive:** Original research stays in Knowledge/

### Concept Validation & Promotion
**Lifecycle:**
1. **Idea:** `type: concept`, `maturity: idea`
2. **Exploration:** Change `maturity: exploration`, add research
3. **Proposal:** Change `maturity: proposed`, create formal draft in `Drafts/Documents/`
4. **Validated:** Change `maturity: validated`, move to active project
5. **Execution:** Convert to project notes, archive concept

---

## Testing Strategy

### Unit Tests
- Frontmatter parsing with various formats (single `---`, double `---`, mixed)
- LLM response parsing with malformed JSON
- Path encoding/decoding with special characters
- Folder path determination logic for each note type
- Type detection accuracy on labeled test set

### Integration Tests

**Test Set 1: Note Type Detection (30 files)**
- 5 meeting notes (1on1, customer, partner, internal, unclear)
- 5 technical notes (architecture, code, infrastructure, research)
- 5 drafts (communication, document, presentation)
- 5 research notes (technical, business, product)
- 3 templates (automation, document, prompt)
- 3 meta notes (log, automation, config)
- 4 concepts (various maturity levels)

**Expected Results:**
- >85% accuracy on type detection
- >90% accuracy on high-confidence type detection
- Low-confidence items properly flagged for manual review

**Test Set 2: Routing Accuracy (20 files)**
- 5 1on1 meetings → correct person folder
- 5 customer meetings → correct location/client folder
- 3 technical notes → correct category folder
- 3 drafts → correct draft type folder
- 2 research → correct category folder
- 2 concepts → correct project folder

**Expected Results:**
- 100% correct folder routing for high-confidence items
- All low-confidence items stay in place, tagged for review

**Test Set 3: Metadata Extraction (15 files)**
- Verify attendees extracted correctly
- Verify action items extracted
- Verify technologies/tools identified
- Verify recipients/stakeholders identified
- Verify sources/citations captured

### Edge Case Testing
- File with no content → should be flagged for manual review
- File with malformed YAML → should handle gracefully
- File already in correct location → should update metadata, not move
- LLM returns invalid JSON → should retry, then flag for manual review
- REST API unavailable → should log error, continue with other files
- Folder name with special characters → should handle correctly
- Duplicate filenames in target folder → should append timestamp
- Very large file (>10,000 words) → should handle without timeout
- File with mixed signals (looks like meeting and technical) → should choose primary type

### Performance Testing
- 100 files: target <5 minutes total
- 500 files: target <20 minutes total
- 1000 files: target <40 minutes total
- LLM timeout handling (>30s response)
- Parallel processing verification

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

### LLM Configuration
**Pass 1 (Type Detection):**
- Model: Qwen or Claude Haiku (faster, cheaper)
- Max tokens: 500
- Temperature: 0.3 (more deterministic)

**Pass 2 (Type-Specific Analysis):**
- Model: Qwen or Claude Sonnet (more accurate)
- Max tokens: 1500
- Temperature: 0.5 (balanced)

---

## Future Enhancements

### Phase 2 (Not in Current Scope)
- **Multi-type content extraction:** Automatically split meeting notes with substantial technical content into separate notes
- **Lifecycle automation:** Auto-promote concepts from idea → exploration → proposed based on triggers
- **Research → Draft conversion:** One-click conversion with template population
- **Template instantiation:** Create new note from template with variable prompting
- **iOS Shortcut integration:** Krisp transcript capture with type pre-selection
- **Email forwarding:** Auto-process emailed content with type detection
- **Real-time processing:** Watch for new files, process immediately
- **Batch undo functionality:** Rollback entire janitor run
- **Web UI for manual review queue:** Review and correct low-confidence items
- **Cross-vault support:** Handle multiple vaults
- **Custom type definitions:** User-defined note types with custom rules

### Phase 3 (Advanced Features)
- **Relationship mapping:** Auto-link related notes across types
- **Duplicate detection:** Identify similar content across vault
- **Content summarization:** Generate summaries for long notes
- **Tag suggestions:** AI-powered tagging based on content
- **Search enhancement:** Semantic search across vault
- **Analytics dashboard:** Vault health metrics, usage patterns
- **Collaborative features:** Team vault management

---

## Success Metrics

### Accuracy Metrics
- **Type detection accuracy:** >85% on test set
- **High-confidence accuracy:** >95% on high-confidence items
- **Routing accuracy:** >90% correct folder placement
- **Metadata extraction accuracy:** >85% complete and correct

### Efficiency Metrics
- **Automation rate:** % of notes filed automatically vs manual review
  - Target: 80%+ automatic filing rate
- **Processing speed:** Average time per file
  - Target: <3 seconds per file
- **Token efficiency:** Average tokens per file
  - Target: <2500 tokens per file (both passes)

### Quality Metrics
- **Vault health:** Reduction in notes in Inbox folder
  - Target: <10 notes in Inbox after weekly run
- **Manual review queue size:** Number requiring manual intervention
  - Target: <5% of total notes
- **User satisfaction:** Perceived quality of metadata extraction
  - Target: >90% "good" or "excellent" on spot checks

### Operational Metrics
- **Uptime:** Successful scheduled runs
  - Target: >95% success rate
- **Error rate:** % of files with processing errors
  - Target: <2%
- **Time savings:** Estimated hours saved per week
  - Target: 5+ hours/week

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| LLM misclassifies note type | Medium | Medium | Two-pass validation, manual review tags, confidence scoring |
| LLM misroutes file | Medium | Low | High-confidence threshold for moves, log all movements |
| REST API failures | High | Low | Retry logic, error logging, graceful degradation |
| File corruption during move | High | Very Low | Obsidian version history, atomic operations, no overwrites |
| LLM cost overruns | Low | Low | Token-efficient two-pass approach, use cheaper models for Pass 1 |
| Network issues (iCloud sync) | Medium | Medium | Run during stable connection, queue retries, local processing |
| Type ambiguity (multi-type notes) | Medium | Medium | Primary type selection, `contains` field for secondary types |
| Processing time exceeds schedule window | Low | Low | Parallel processing, incremental runs, priority queue |
| New note types emerge | Medium | Medium | Flexible type system, easy to add new types, concept fallback |
| User changes vault structure | Medium | Low | Validate folder structure on startup, log warnings |

---

## Dependencies

- **n8n** (v1.0+)
- **Obsidian** with Local REST API plugin enabled
- **LLM API access** (Qwen or Claude Sonnet 4)
- **macOS** file system access (iCloud Drive path)
- **Node.js runtime** (for n8n)
- **Stable internet connection** (for LLM API calls)

---

## Appendix A: Complete Frontmatter Schemas

### Meeting Note
```yaml
---
date: 2025-01-20
type: meeting
meeting_type: 1on1|customer|partner|internal
person: David Determan          # If 1on1
client: Phia                    # If customer
location: Boston                # If customer
partner: EchoStor              # If partner
team: Sales Teams              # If internal
attendees: David Determan, Josh Davis
summary: Q1 planning and deal review
project: unclassified
status: processed
contains: [technical-content]   # Optional: if has substantial non-meeting content
related_notes: [[Tech Note]]    # Optional
---
```

### Technical Note
```yaml
---
type: technical-note
category: architecture|code|infrastructure|research
technologies: [Docker, Kubernetes, n8n]
related_projects: [AI CTRL]
summary: Vault automation system architecture
status: draft|active|archived
created: 2025-01-20
updated: 2025-01-22
contains: []
related_notes: []
---
```

### Draft
```yaml
---
type: draft
draft_type: communication|document|presentation
recipient: [Rob McCafferty, Jeff Fertitta]
purpose: proposal|update|request|fyi
title: AI-Enhanced Discovery Process Proposal
summary: Proposal for automating discovery process
status: draft|review|final
created: 2025-01-20
send_by: 2025-01-27
source_template: [[Template, Proposal]]  # Optional
---
```

### Research
```yaml
---
type: research
topic: DRaaS Market Analysis 2025
category: technical|business|product
subcategory: competitors|industry-analysis|evaluation
sources: [https://gartner.com/draas, https://forrester.com/bcdr]
related_to: [Active Deal - Phia]
summary: Comprehensive analysis of DRaaS market leaders
status: in-progress|complete
created: 2025-01-18
updated: 2025-01-20
---
```

### Template
```yaml
---
type: template
template_type: automation|document|prompt
use_case: Discovery call follow-up email
variables: [client_name, attendees, next_steps, date]
version: 2.1
updated: 2025-01-20
description: Standard template for post-discovery email
---
```

### Meta
```yaml
---
type: meta
meta_type: log|automation|configuration
system: vault-janitor|n8n|obsidian
created: 2025-01-20
description: Daily processing log
---
```

### Concept
```yaml
---
type: concept
title: Automated RFP Response System
maturity: idea|exploration|proposed|validated
related_project: AI CTRL
stakeholders: [Jeff Fertitta, David Saliba, Rob McCafferty]
summary: System to auto-generate RFP responses using AI
created: 2025-01-19
updated: 2025-01-20
validation_criteria: [Accuracy >90%, Time savings >50%]
---
```

---

## Appendix B: Sample Note Transformations

### Example 1: Meeting Note (Before → After)

**Before:**
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

**After:**
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
- DMSi partnership strategy and next steps
- AGC Bio L7 engagement timeline
- Strategic positioning for both opportunities

## Action Items
- [ ] Follow up with DMSi on partnership details by 2025-01-10
- [ ] Schedule next discussion on AGC Bio for 2025-01-14
- [ ] Prepare proposal outline for both opportunities

### Transcript
<details>
insert transcript
</details>
```

**File moved to:** `Work/Areas/One on One Meetings/David Determan/2025-01-07 Determan and Davis Sync.md`

---

### Example 2: Technical Note Detection

**Before:**
```markdown
# n8n Webhook Authentication

Need to secure the vault janitor webhook endpoint.

Options:
1. API key in header
2. Basic auth
3. OAuth

Code example:
```javascript
const crypto = require('crypto');
const apiKey = process.env.API_KEY;
```

Going with option 1 for simplicity.
```

**After:**
```markdown
---
type: technical-note
category: code
technologies: [n8n, JavaScript, Node.js]
related_projects: [AI CTRL]
summary: Webhook authentication implementation for vault janitor
status: active
created: 2025-01-20
updated: 2025-01-20
---

# n8n Webhook Authentication

Need to secure the vault janitor webhook endpoint.

Options:
1. API key in header
2. Basic auth
3. OAuth

Code example:
```javascript
const crypto = require('crypto');
const apiKey = process.env.API_KEY;
```

Going with option 1 for simplicity.
```

**File moved to:** `Work/Knowledge/Technical/Code/n8n Webhook Authentication.md`

---

### Example 3: Draft Document Detection

**Before:**
```markdown
# Q1 AI Strategy Proposal

**Draft - Do Not Share**

To: Rob McCafferty, Jeff Fertitta
From: Josh Davis
Re: AI-Enhanced Sales Process

[TBD: Executive summary]

## Background
We've been manually handling discovery calls...

## Proposal
Automate the following...

## ROI
[TBD: Calculate savings]
```

**After:**
```markdown
---
type: draft
draft_type: document
recipient: [Rob McCafferty, Jeff Fertitta]
purpose: proposal
title: Q1 AI Strategy Proposal - AI-Enhanced Sales Process
summary: Proposal to automate discovery call processes using AI
status: draft
created: 2025-01-20
send_by: 2025-01-31
---

# Q1 AI Strategy Proposal

**Draft - Do Not Share**

To: Rob McCafferty, Jeff Fertitta
From: Josh Davis
Re: AI-Enhanced Sales Process

[TBD: Executive summary]

## Background
We've been manually handling discovery calls...

## Proposal
Automate the following...

## ROI
[TBD: Calculate savings]
```

**File moved to:** `Work/Drafts/Documents/Q1 AI Strategy Proposal.md`

---

### Example 4: Research Note Detection

**Before:**
```markdown
# DRaaS Competitive Analysis

Sources:
- Gartner Magic Quadrant 2024
- Forrester Wave Report
- G2 Reviews

## Top Vendors

**Veeam**
- Market leader
- Strong in enterprise
- [15 more bullet points...]

**Zerto**
- Cloud-native approach
- [details...]

[3000+ words of analysis]
```

**After:**
```markdown
---
type: research
topic: DRaaS Competitive Landscape 2025
category: business
subcategory: competitors
sources: [https://gartner.com/mq-draas, https://forrester.com/wave-draas, https://g2.com/categories/draas]
related_to: [Active Deal - Phia, Active Deal - FCFCU]
summary: Comprehensive competitive analysis of top 5 DRaaS vendors for positioning
status: complete
created: 2025-01-18
updated: 2025-01-20
---

# DRaaS Competitive Analysis

Sources:
- Gartner Magic Quadrant 2024
- Forrester Wave Report
- G2 Reviews

## Top Vendors

**Veeam**
- Market leader
- Strong in enterprise
- [15 more bullet points...]

**Zerto**
- Cloud-native approach
- [details...]

[3000+ words of analysis]
```

**File moved to:** `Work/Knowledge/Business/Competitors/DRaaS Competitive Analysis.md`

---

## Document History
- **v2.0** - 2025-01-20 - Added multi-type note support with two-pass LLM analysis
- **v1.0** - 2025-01-20 - Initial PRD (meeting notes only)
- **Author:** Claude (Anthropic)
- **Stakeholder:** Josh Davis
- **Status:** Ready for Implementation