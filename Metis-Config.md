---
type: meta
meta_type: configuration
system: metis
created: 2026-01-22
updated: 2026-01-22
---

# Metis Configuration

This file provides context to the Metis workflow for smarter note classification and routing.

---

## Attendee Context (Expedient Team)

### Leadership
- Rob McCafferty (manager)

### Direct Reports
- David Determan
- Patrick Rosenberger
- Keith Cadieux

### Team Members
- Ben Gallo
- Brian Lacombe
- Chad St. Thomas
- David Saliba
- Jacob Figueroa
- Jason Molitor
- Aaron Littlejohn

### Extended Team
- Jeff Fertitta
- Anthony Jackman
- Duane Weber
- Bob Carter
- Kate Rance

---

## Known Clients by Location

### Boston
AAA, Bluestone Bank, Chase Corp, City Brewing, DFCU, Element Fleet Management, Fiduciary Trust, Flower City, GW&K, Hawkes Learning, Logitech, Medwiz, Metropolitan Opera, Phia, St. Mary's Bank, Tricon, U Mass Med, United Way CT

### Denver
AGC Bio, City and County of Denver, DMSi, Pursuit Collective

### Milwaukee
Arhaus, Aspirus, Badger Color, BDO, Duly Healthcare, Falcon Plastics, ITASKA, Medline, Messer Cutting, The Mutual Group

### Indianapolis
Aces Power, Byrider, FCFCU, Ford Meter Box, Graham Packaging, Heartland Dental, Indiana Interactive, Ivy Tech, KELMAR, Republic Airways, Rural King

### Cincinnati
MCC Label, US Urology

### Phoenix
Brinks Home Security, City of Avondale, Conagra Brands, Moxa, New England Health Plan, PacketWatch, Sonora Quest, Test Equity, Thryv, Tractor Supply

### Louisville
Lifespring

---

## Known Partners

- EchoStor
- Pure Storage
- VMware
- Nutanix
- Microsoft

---

## Folder Routing Rules

### Meeting Notes
- 1on1 meetings → `Work/Areas/One on One Meetings/{person}/`
- Customer meetings → `Work/Projects/Active Deals/Clients/{location}/{client}/`
- Partner meetings → `Work/Projects/Active Deals/Partners/{partner}/`
- Internal team meetings → `Work/Areas/Expedient Teams/{team}/`

### Technical Notes
- Architecture → `Work/Knowledge/Technical/Architecture/`
- Code → `Work/Knowledge/Technical/Code/`
- Infrastructure → `Work/Knowledge/Technical/Infrastructure/`
- Research → `Work/Knowledge/Technical/Research/`

### Drafts
- Communication → `Work/Drafts/Communications/`
- Document → `Work/Drafts/Documents/`
- Presentation → `Work/Drafts/Presentations/`

### Research
- Technical → `Work/Knowledge/Technical/Research/`
- Business (Competitor) → `Work/Knowledge/Business/Competitors/`
- Business (Industry) → `Work/Knowledge/Business/Industry Analysis/`
- Product → `Work/Knowledge/Product/`

### Templates
- Automation → `Work/Templates/Automation/`
- Prompt → `Work/Templates/Prompts/`
- Document → `Work/Templates/Documents/`

### Meta
- Log → `Work/Meta/Logs/`
- Automation → `Work/Meta/Automation/`
- Configuration → `Work/Meta/Configuration/`

### Concepts
- With project → `Work/Projects/{related_project}/Concepts/`
- Product-related → `Work/Knowledge/Product/Features/`
- General → `Work/Drafts/Documents/`
