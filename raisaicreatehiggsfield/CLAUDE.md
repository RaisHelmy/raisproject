# RAISAI CREATE

## AI CREATIVE STUDIO + VISUAL WORKFLOW ENGINE + MCP PLATFORM

You are building **RaisAI Create**.

RaisAI Create is a comprehensive AI creation platform designed around:

* Cloudflare AI
* prepaid usage
* transparent final pricing
* visual node workflows
* reusable templates
* movie/video production
* image generation
* video generation
* audio generation
* text generation
* image understanding
* AI agents
* MCP
* API
* Node.js connector
* shareable workflows

The product should feel simple to a normal user while being extremely powerful for advanced users.

The central philosophy is:

> **Simple for beginners. Unlimited composition for advanced users.**

Do NOT build another basic:

Prompt → Generate

AI website.

Build an **AI creation operating system**.

---

# 1. PRODUCT IDENTITY

Product name:

**RaisAI Create**

The product should communicate:

> Create anything.
> Connect anything.
> Automate anything.

The core experience should allow someone to start with:

"I want to make a movie."

and eventually build:

Script
→ Character creation
→ Character consistency
→ Storyboard
→ Scene generation
→ Image generation
→ Image-to-video
→ Voice generation
→ Sound effects
→ Music
→ Editing
→ Subtitles
→ Final video

without leaving RaisAI Create.

---

# 2. RESEARCH REFERENCE

Study:

https://github.com/Autom8AI/Open-Higgsfield-AI

Use it as inspiration.

Do NOT simply clone the repository.

The repository demonstrates useful concepts including:

* image studio
* video studio
* cinema studio
* dynamic model controls
* multiple reference images
* generation history
* model capability-driven UI
* reusable creative workflows

These are useful references.

However RaisAI Create must have a fundamentally different architecture.

Open-Higgsfield is a creative frontend.

RaisAI Create is:

**Creative frontend + workflow engine + AI infrastructure + MCP + API + automation platform.**

---

# 3. IMPORTANT DIFFERENCE FROM HIGGSFIELD

Do NOT reproduce the exact Higgsfield interface.

Do NOT make RaisAI Create look like a clone.

Take inspiration from the interaction patterns.

Improve them.

RaisAI Create must emphasize:

* model freedom
* node composition
* workflow reuse
* transparent pricing
* API access
* MCP
* automation
* project-based production
* movie production
* developer access

---

# 4. PRICING PHILOSOPHY

Users use a prepaid balance.

Example:

User adds:

RM50

User generates an image.

Final cost:

RM0.38

Balance becomes:

RM49.62

The customer does NOT need to know the internal provider economics.

DO NOT expose:

Cloudflare cost
RaisAI markup
20% markup
provider margin
internal profit

to the normal user.

The user sees only:

Estimated cost

and:

Final charged amount

Example:

---

Generate Image

Estimated cost

RM0.38

[ Generate ]

---

After completion:

Generation completed

Cost:
RM0.38

Remaining balance:
RM49.62

---

The internal system may maintain:

providerCost
markup
margin
actualCost

for administrative accounting.

But those are NOT part of the customer-facing UX.

---

# 5. PRICING REQUIREMENTS

Every generation must have:

estimatedCost

actualCost

currency

balanceBefore

balanceAfter

The frontend displays:

Estimated cost: RMX.XX

After completion:

Charged: RMX.XX

If estimation cannot be guaranteed:

show:

Estimated from current provider pricing.

Never lie about exact pricing.

---

# 6. PROVIDER ABSTRACTION

Cloudflare is the initial provider.

Create:

AIProvider

with capabilities such as:

* listModels()
* getModel()
* estimateCost()
* execute()
* getJob()
* cancelJob()
* validateInput()

Cloudflare implementation:

CloudflareAIProvider

Do NOT put Cloudflare-specific logic inside React components.

Architecture:

React
↓
API
↓
Application Services
↓
Provider Abstraction
↓
Cloudflare AI

---

# 7. MODEL SUPPORT

RaisAI Create must NOT hard-code a small list of models.

The model catalog must be dynamic.

Cloudflare currently exposes a broad model catalog across task types, including image generation, text generation, image understanding, speech and other capabilities.

The system should treat models as data.

Example:

Model:

FLUX

Capabilities:

text-to-image
image-to-image

Another model:

VideoModel

Capabilities:

image-to-video

Another:

LLM

Capabilities:

text-generation
vision
tool-calling

Another:

TTS

Capabilities:

text-to-speech

---

# 8. MODEL REGISTRY

Create a model registry.

Each model contains:

id

provider

displayName

description

category

capabilities

inputSchema

outputSchema

parameterSchema

pricing

limits

availability

documentation

version

deprecated

Example:

{
id: "model-id",
provider: "cloudflare",
displayName: "Example Model",
category: "image",
capabilities: [
"text-to-image",
"image-to-image"
],
inputs: {
prompt: "string",
image: "image[]"
},
outputs: {
image: "image"
},
parameters: {}
}

---

# 9. CAPABILITY-DRIVEN UI

This is extremely important.

Never build:

if model == X
show control Y

Instead:

if capability exists:

show control.

For example:

supports:

imageInput

→ show image upload.

supports:

multipleImages

→ show multi-image picker.

supports:

duration

→ show duration.

supports:

resolution

→ show resolution.

supports:

negativePrompt

→ show negative prompt.

supports:

seed

→ show seed.

supports:

aspectRatio

→ show aspect ratio.

The model definition controls the UI.

This allows new models to be added without rewriting the frontend.

---

# 10. MAIN APPLICATION

Primary navigation:

Create

Projects

Templates

Workflows

Assets

History

Usage

MCP

API

Connectors

Account

Admin

Do not show every feature to new users.

The beginner experience should primarily show:

Create
Projects
Templates
History

Advanced features can appear under:

Automation
Developer
Advanced

---

# 11. CREATE HOME

The Create page is the most important page.

Do NOT immediately show a complicated node editor.

Start with:

"What do you want to create?"

Cards:

Image

Video

Audio

Text

Movie

Workflow

Each opens a specialized starting experience.

Example:

Image:

Prompt → Model → Generate

Video:

Prompt/Image → Model → Generate

Movie:

Idea → Story → Characters → Scenes → Video → Audio → Timeline

Workflow:

Blank Canvas

---

# 12. QUICK CREATE

Normal users should never need to understand nodes.

Example:

User clicks:

Image

Then sees:

Prompt

[Describe your image...]

Reference image

[ Upload ]

Model

[ Recommended ]

Aspect ratio

[ 16:9 ]

Estimated cost

RM0.35

[ Generate ]

That is the entire basic workflow.

---

# 13. ADVANCED MODE

Every creation experience should have:

Basic

Advanced

toggle.

Basic:

simple controls.

Advanced:

all supported model parameters.

Example:

Prompt

Negative Prompt

Seed

Steps

Guidance

Scheduler

Resolution

Aspect Ratio

Reference Images

Strength

Quality

etc.

Only display parameters supported by the selected model.

---

# 14. VISUAL NODE ENGINE

The node engine is a core product feature.

Users should be able to visually connect AI operations.

Example:

[Prompt]
↓
[LLM]
↓
[Image Generator]
↓
[Image-to-Video]
↓
[TTS]
↓
[Audio Mixer]
↓
[Video Composition]
↓
[Export]

This is the foundation of movie production.

---

# 15. NODE EDITOR UX

Use a professional node editor.

Recommended interaction:

Canvas

Pan:

middle mouse / trackpad

Zoom:

wheel / pinch

Select:

click

Multi-select:

drag / shift

Connect:

drag from output → input

Delete:

Delete / Backspace

Duplicate:

Ctrl/Cmd + D

Undo:

Ctrl/Cmd + Z

Redo:

Ctrl/Cmd + Shift + Z

Fit canvas:

keyboard shortcut

Run:

Run Workflow

Stop:

Stop

Save:

automatic

---

# 16. NODE DESIGN

Nodes should be compact.

Example:

┌───────────────────────────┐
│ IMAGE GENERATOR           │
├───────────────────────────┤
│ Model                     │
│ FLUX                      │
│                           │
│ Prompt                    │
│ ○ prompt                  │
│                           │
│ Image                     │
│ ● image                   │
│                           │
│ [Run]                     │
└───────────────────────────┘

Inputs:

○

Outputs:

●

Different types should be strongly typed.

---

# 17. NODE TYPES

Build the architecture around node types.

Core nodes:

Input

Prompt

Text

Image

Video

Audio

File

Model

Transform

Condition

Router

Merge

Split

Loop

Delay

Webhook

HTTP

Code

MCP

Output

---

# 18. AI NODES

AI nodes should include:

LLM

Image Generator

Image Editor

Image Upscaler

Vision

Video Generator

Video Editor

Speech-to-Text

Text-to-Speech

Music Generator

Sound Generator

Translation

Embedding

Classifier

Object Detection

The exact available operations depend on provider/model capabilities.

---

# 19. MODEL NODE

Do not create one node for every model.

Create:

AI Model Node

Inside:

Model selector

Example:

[ AI Model ]

Task:

Image Generation

Model:

[ FLUX ]

Parameters dynamically appear.

If user changes model:

the parameter UI updates.

This prevents the node library from becoming enormous.

---

# 20. INPUT NODE

Input nodes allow workflows to become reusable.

Example:

Movie Template:

[Character Image]
[Character Name]
[Script]
[Style]
[Voice]

These are variables.

When user executes the template:

the system asks for the required inputs.

---

# 21. VARIABLE SYSTEM

Templates and workflows support:

{{character_name}}

{{character_image}}

{{scene_description}}

{{style}}

{{duration}}

{{voice}}

Variables must be typed.

Example:

character_name:

string

character_image:

image

duration:

number

aspect_ratio:

enum

This prevents invalid workflow execution.

---

# 22. CONNECTION TYPES

Inputs and outputs must be typed.

Supported types:

string

number

boolean

json

image

image[]

video

audio

file

text

prompt

model

array

object

Any

The editor should prevent invalid connections.

Example:

image → image

valid.

image → number

invalid.

---

# 23. NODE EXECUTION ENGINE

A workflow is a directed graph.

Example:

A → B → C

The execution engine should:

1. Validate graph.
2. Detect cycles where unsupported.
3. Resolve dependencies.
4. Execute nodes.
5. Store node outputs.
6. Pass outputs forward.
7. Handle failures.
8. Retry where configured.
9. Track cost.
10. Produce final outputs.

---

# 24. WORKFLOW EXECUTION

Workflow state:

DRAFT

QUEUED

RUNNING

PAUSED

COMPLETED

FAILED

CANCELLED

Each node:

PENDING

RUNNING

COMPLETED

FAILED

SKIPPED

---

# 25. NODE EXECUTION RECORD

Store:

workflowRunId

nodeId

nodeType

model

input

output

status

startedAt

completedAt

duration

error

estimatedCost

actualCost

providerRequestId

This makes debugging possible.

---

# 26. PARTIAL EXECUTION

Users should be able to execute:

Entire workflow

or:

Selected node

or:

Node + downstream nodes

Example:

A → B → C → D

User changes B.

They should be able to rerun:

B → C → D

without rerunning A.

This is extremely important for expensive AI workflows.

---

# 27. CACHING

If node input is identical and caching is enabled:

reuse previous result.

Example:

Prompt

*

Model

*

Parameters

produce:

cache key.

Cache should be optional.

Users should know when a cached result is being reused.

---

# 28. COST PREVIEW FOR WORKFLOWS

Before running a workflow:

calculate:

estimated total cost.

Example:

Workflow:

LLM:
RM0.04

Image:
RM0.32

Video:
RM1.40

TTS:
RM0.12

Estimated total:

RM1.88

Display only:

**Estimated cost: RM1.88**

Do not expose internal provider cost or markup.

---

# 29. WORKFLOW COST SAFETY

Before executing:

Check balance.

If estimated cost:

RM8.40

Balance:

RM3.20

show:

Insufficient balance.

Estimated cost:

RM8.40

Available:

RM3.20

[Add Balance]

Do not partially execute unless the workflow explicitly supports partial execution.

---

# 30. MOVIE MODE

Movie creation should be a first-class feature.

User selects:

Create Movie

The system should guide them through:

Idea

Story

Characters

World

Scenes

Storyboard

Shots

Voice

Music

Sound

Video

Editing

Export

---

# 31. MOVIE PROJECT STRUCTURE

Movie:

Project

├── Story
├── Characters
├── Locations
├── Props
├── Scenes
├── Shots
├── Dialogue
├── Voice
├── Music
├── Sound Effects
├── Clips
├── Timeline
└── Export

---

# 32. STORY GENERATION

User can enter:

"I want a 10-minute cyberpunk detective movie in Kuala Lumpur."

The AI can generate:

Title

Logline

Synopsis

Characters

Act structure

Scenes

Dialogue

Shot descriptions

Visual style

Audio requirements

The output becomes editable structured data.

Do NOT keep the entire movie as one giant text blob.

---

# 33. CHARACTER SYSTEM

Characters are persistent project entities.

Example:

Character:

Aiman

Age:

32

Description:

Detective

Appearance:

...

Personality:

...

Voice:

...

Reference images:

...

Consistency assets:

...

The user should be able to reuse the character in multiple scenes.

---

# 34. CHARACTER CONSISTENCY

Movie generation should allow users to provide:

reference image

character sheet

multiple references

style reference

location reference

The workflow should pass those assets into compatible models.

If a selected model does not support the required inputs:

show a clear compatibility warning.

---

# 35. LOCATION SYSTEM

Locations should be persistent.

Example:

Location:

Kuala Lumpur Night Market

Description:

...

Reference images:

...

Style:

...

Lighting:

...

Scenes can reference the same location.

---

# 36. SCENE SYSTEM

Each scene contains:

Scene number

Title

Location

Time

Characters

Dialogue

Action

Visual style

Camera

Lighting

Duration

Shots

---

# 37. SHOT SYSTEM

A scene contains multiple shots.

Example:

Scene 4:

Shot 1

Wide establishing shot

5 sec

Shot 2

Medium shot

4 sec

Shot 3

Close-up

3 sec

Shot 4

Tracking shot

6 sec

Each shot can become an AI generation job.

---

# 38. CINEMATIC CONTROLS

Provide optional controls:

Shot type

Camera movement

Lens

Focal length

Depth of field

Aperture

Lighting

Time of day

Composition

Framing

Motion

Style

The controls should be model-aware.

Do not expose meaningless controls to models that cannot use them.

---

# 39. STORYBOARD

Storyboard view:

┌─────┐ ┌─────┐ ┌─────┐
│ 01  │ │ 02  │ │ 03  │
│ IMG │ │ IMG │ │ IMG │
└─────┘ └─────┘ └─────┘

Each card:

Shot number

Image

Duration

Description

Characters

Status

Cost

---

# 40. SHOT GENERATION

User should be able to:

Generate storyboard

Regenerate shot

Generate video

Regenerate video

Change model

Change prompt

Change duration

Replace reference

Keep previous version

Compare versions

---

# 41. VERSIONING

Every generated asset should support versions.

Example:

Shot 03

Version 1

Version 2

Version 3

Version 4

The user can select:

Use Version 3

Never destroy previous generation unless explicitly deleted.

---

# 42. VIDEO PIPELINE

A movie shot workflow could be:

Character references
+
Scene description
+
Camera direction
↓
Image generation
↓
Image review
↓
Image-to-video
↓
Video review
↓
Sound effect
↓
Dialogue
↓
Timeline

Each step can be a node.

---

# 43. AUDIO

Support audio as first-class data.

Types:

Voice

Dialogue

Music

Sound effect

Ambient sound

Audio track

The workflow engine must treat audio as a typed asset.

---

# 44. VOICE

Voice workflow:

Dialogue text
↓
TTS model
↓
Audio

Character can have:

voice configuration

voice model

voice parameters

---

# 45. SUBTITLES

Generate subtitles from:

script

or

speech-to-text.

Support:

SRT

VTT

embedded subtitles

---

# 46. TIMELINE

Movie mode needs a timeline.

Tracks:

Video

Voice

Dialogue

Music

SFX

Subtitles

Example:

Video:
| Scene 1 | Scene 2 | Scene 3 |

Voice:
|------Dialogue------|

Music:
|-------------Music-------------|

SFX:
| SFX |     | SFX |

Timeline should eventually support:

trim

split

move

duplicate

mute

volume

fade

transitions

---

# 47. ASSET LIBRARY

Every generated asset should be accessible from:

Assets

Types:

Images

Videos

Audio

Documents

References

Characters

Locations

Templates

The asset library should use:

R2 for binary files.

D1 for metadata.

---

# 48. ASSET REUSE

Users should not repeatedly upload the same assets.

Once uploaded:

store it.

Then allow:

Use in workflow

Use in project

Use in template

Use in movie

---

# 49. TEMPLATES

Templates are reusable workflows.

A template can contain:

nodes

connections

variables

default values

model preferences

prompt templates

input requirements

output requirements

preview

description

tags

author

visibility

---

# 50. TEMPLATE TYPES

Templates can be:

Image template

Video template

Social media template

Advertisement template

Movie template

Character template

Workflow template

Automation template

---

# 51. TEMPLATE EXAMPLE

Template:

"Product Commercial"

Inputs:

product_image

product_name

brand_style

voice

duration

Workflow:

Product Image
↓
Vision Analysis
↓
Script Generator
↓
Storyboard
↓
Image Generation
↓
Image-to-Video
↓
Voice
↓
Music
↓
Video Composition
↓
Export

User clicks:

Use Template

and fills:

Product:

[upload]

Brand:

[My Brand]

Duration:

[15 sec]

Then:

Generate

---

# 52. PUBLIC TEMPLATES

Users can publish templates.

Visibility:

Private

Unlisted

Public

Public templates have:

title

description

preview

author

tags

usage count

estimated cost

supported models

---

# 53. TEMPLATE SHARING

Public template URL:

/templates/:id

The user should be able to:

View

Preview

Use Template

Duplicate

---

# 54. TEMPLATE VERSIONING

Templates must support versions.

If author changes:

Version 2

Existing executions remain associated with Version 1.

Never silently change historical executions.

---

# 55. WORKFLOW MARKETPLACE

Eventually allow users to discover workflows.

Categories:

Film

Marketing

YouTube

TikTok

Instagram

Product

Education

Business

Photography

Animation

Developer

Automation

---

# 56. MCP

MCP must be a first-class platform interface.

The same application services must power:

Web

API

MCP

Node SDK

Do NOT duplicate business logic.

Architecture:

UI
↓
Application Service
↓
Workflow Engine
↓
AI Provider

MCP
↓
Application Service
↓
Workflow Engine
↓
AI Provider

API
↓
Application Service
↓
Workflow Engine
↓
AI Provider

---

# 57. MCP TOOLS

Expose tools such as:

list_models

get_model

estimate_cost

create_generation

get_generation

cancel_generation

list_templates

get_template

execute_template

list_workflows

execute_workflow

get_workflow_run

get_asset

list_assets

get_balance

get_usage

---

# 58. MCP WORKFLOW EXECUTION

An AI agent should be able to say conceptually:

"Create a cinematic cyberpunk scene using my Cyberpunk Template."

MCP:

execute_template

Inputs:

templateId

variables

The result:

workflowRunId

status

outputs

cost

---

# 59. MCP SAFETY

Never allow MCP to bypass:

balance

permissions

rate limits

project ownership

template permissions

model restrictions

API scopes

Every MCP request must have:

user

token

scope

request ID

---

# 60. API

Everything important should have REST APIs.

Example:

POST /api/v1/workflows

POST /api/v1/workflows/:id/run

GET /api/v1/workflow-runs/:id

POST /api/v1/generations

GET /api/v1/generations/:id

GET /api/v1/models

GET /api/v1/templates

POST /api/v1/templates/:id/execute

GET /api/v1/assets

GET /api/v1/usage

GET /api/v1/balance

---

# 61. NODE.JS CONNECTOR

Provide a Node.js SDK.

Example conceptual API:

const raisai = new RaisAI({
apiKey: process.env.RAISAI_API_KEY
});

const result = await raisai.workflow.run(
"movie-scene-generator",
{
character: characterImage,
scene: "Rainy night in Kuala Lumpur"
}
);

The SDK should eventually support:

models

generations

workflows

templates

assets

MCP

webhooks

---

# 62. WEBHOOKS

Support:

generation.completed

generation.failed

workflow.completed

workflow.failed

asset.created

template.executed

balance.low

Webhook payloads should include:

event

id

timestamp

resource

status

outputs

cost

---

# 63. RETRIES

Workflow nodes should optionally support:

retry count

retry delay

retry conditions

Example:

Retry:

3 times

Delay:

5 seconds

Only retry:

provider timeout

Do not retry:

invalid input

insufficient balance

permission denied

---

# 64. FAILURE HANDLING

When one node fails:

Show:

Node failed

Reason

Retry

Edit

Skip

Stop workflow

If possible:

Resume from failed node.

Do not force users to restart expensive workflows.

---

# 65. QUEUE ARCHITECTURE

Long-running operations should be asynchronous.

Use:

Cloudflare Queues

where appropriate.

Architecture:

Request
↓
Create workflow run
↓
Queue
↓
Worker
↓
AI provider
↓
Store result
↓
Update node
↓
Continue workflow

---

# 66. REAL-TIME UI

The UI should receive status updates using an appropriate mechanism.

Potential approaches:

WebSocket

SSE

polling fallback

The UI should show:

Queued

Running

Generating

Processing

Completed

Failed

---

# 67. DATABASE

Use Cloudflare D1.

Core tables:

users

organizations

projects

project_members

models

model_versions

assets

asset_versions

generations

generation_inputs

generation_outputs

workflows

workflow_versions

workflow_nodes

workflow_edges

workflow_variables

workflow_runs

node_runs

templates

template_versions

template_variables

balance_transactions

usage_records

api_keys

mcp_tokens

webhooks

webhook_deliveries

connectors

movies

characters

locations

scenes

shots

timeline_tracks

timeline_items

---

# 68. STORAGE

Cloudflare R2:

uploads

generated images

generated videos

audio

thumbnails

storyboards

exports

movie files

Do NOT put binary data in D1.

D1 stores metadata.

---

# 69. PROJECTS

Everything belongs to a project.

Project:

"Cyberpunk Movie"

Contains:

Characters

Locations

Scenes

Shots

Assets

Workflows

Generations

Timeline

Exports

This allows users to keep work organized.

---

# 70. ORGANIZATIONS

Design database architecture so organizations can eventually support:

personal account

team

company

members

roles

shared balance

shared projects

Do not build complex enterprise administration initially.

But avoid a database design that prevents it later.

---

# 71. BALANCE SYSTEM

Use a ledger.

Transactions:

deposit

reservation

charge

refund

adjustment

Do not simply mutate a balance field without recording transactions.

For generation:

1. estimate
2. reserve
3. execute
4. determine actual cost
5. charge actual amount
6. refund unused reservation

The customer sees:

Estimated cost

and then:

Charged amount

Internal provider accounting is hidden.

---

# 72. ADMIN PRICING

Admin can configure:

provider pricing

internal markup

model pricing

minimum charge

rounding

currency

availability

The customer should NOT see the markup configuration.

Customer-facing pricing should be:

Final price.

---

# 73. USAGE DASHBOARD

Show:

Total spent

Today

This month

Generations

Workflows

Movies

Most-used models

Most-used templates

Project spending

Use Highcharts.

Charts:

Daily spending

Monthly spending

Generation count

Cost by category

Cost by model

---

# 74. USER UX

The UX must always answer:

What can I do?

What do I need?

How much will it cost?

What is happening?

What did I get?

What can I do next?

---

# 75. EMPTY STATES

Never show blank screens.

Example:

Projects

"No projects yet."

[Create Project]

Templates

"Create your first reusable AI workflow."

[Create Template]

Assets

"Upload an image or generate your first asset."

---

# 76. BEGINNER EXPERIENCE

A first-time user should NOT see:

D1

MCP

API keys

Node schemas

Provider costs

Queue configuration

Advanced model parameters

Instead:

Create

Templates

Projects

History

---

# 77. POWER USER EXPERIENCE

Power users can enable:

Advanced mode

Workflow editor

Model parameters

API

MCP

Node connector

Debug information

Execution logs

---

# 78. NODE EDITOR — BEGINNER MODE

Do not show 100 node types.

Recommended nodes:

Prompt

Image

Video

Text

AI

Output

Then:

"More Nodes"

opens:

Advanced Node Library.

---

# 79. NODE LIBRARY

Node library categories:

AI

Input

Output

Media

Logic

Data

Automation

Developer

MCP

Utilities

---

# 80. NODE SEARCH

Users should be able to search:

"image"

"video"

"tts"

"llm"

"webhook"

"HTTP"

"MCP"

"resize"

"merge"

"loop"

---

# 81. NODE CONFIGURATION PANEL

When selecting a node:

Right-side panel opens.

Example:

AI Image

Model

[Flux]

Prompt

[................]

Aspect ratio

[16:9]

Quality

[High]

Reference images

[ + Add ]

Estimated cost:

RM0.41

[Run Node]

---

# 82. NODE OUTPUT PREVIEW

Nodes should display outputs.

Image node:

thumbnail.

Video node:

video preview.

Audio node:

audio player.

Text:

text preview.

This makes the workflow visually understandable.

---

# 83. DEBUGGING

Advanced mode should allow:

View input

View output

View execution time

View model

View request ID

View error

View retry

View cost

Do not expose provider secrets.

---

# 84. WORKFLOW SAVE

Auto-save workflow drafts.

Show:

Saved

Saving...

Unsaved changes

Do not force users to constantly click Save.

---

# 85. WORKFLOW COLLABORATION

Prepare architecture for:

share

duplicate

fork

template

public/private

Later:

team collaboration

real-time editing

comments

---

# 86. MOVIE GENERATION UX

Do not force users into a node graph immediately.

Movie mode should have:

1. Story
2. Characters
3. Scenes
4. Storyboard
5. Shots
6. Audio
7. Timeline
8. Export

The underlying system can be node-driven.

The user interface does not need to expose every node.

This is a major UX principle.

---

# 87. MOVIE MODE + WORKFLOW MODE

Two interfaces.

Movie Mode:

high-level creative workflow.

Workflow Mode:

technical graph.

Example:

Movie Mode:

Scene 3

Shot 4

Generate

Workflow Mode:

Character Reference
↓
Prompt Builder
↓
Image Model
↓
Video Model
↓
SFX
↓
Voice
↓
Composite

Users can switch between them.

---

# 88. MODEL SELECTION UX

Do not overwhelm users with 100 models.

Provide:

Recommended

Fast

Quality

Cheap

Cinematic

Experimental

Advanced

Users can click:

"All Models"

for the full catalog.

---

# 89. MODEL COMPARISON

Allow:

Compare models

Example:

Prompt:

"A rainy cyberpunk street"

Models:

Model A

Model B

Model C

Generate comparison.

Display results side-by-side.

This is extremely useful because RaisAI Create supports many models.

---

# 90. MODEL FAVORITES

Users can favorite models.

Show:

My Models

Recommended

Recently Used

---

# 91. MODEL COMPATIBILITY

When a workflow requires:

image input

but model does not support image input:

show:

"This model does not support image references."

Offer:

Compatible Models

---

# 92. COST-AWARE MODEL SELECTION

Show final estimated cost next to model.

Example:

Fast Model

RM0.18

Quality Model

RM0.52

Premium Model

RM1.10

Do not show provider internal cost.

---

# 93. TRANSPARENT PRICING UI

Use:

Estimated cost

Final charged

Balance remaining

NOT:

credits

unless a specific UX context absolutely requires it.

The customer should understand that they are spending real prepaid money.

---

# 94. NO FAKE CREDIT ECONOMY

Do not create:

100 credits

500 credits

1000 credits

where users cannot understand what one credit means.

Use currency.

Example:

Balance:

RM23.40

Generation:

RM0.48

Remaining:

RM22.92

This is a major RaisAI Create differentiator.

---

# 95. MOBILE UX

Mobile must support:

Quick Create

History

Templates

Project viewing

Generation

Basic workflow execution

Movie storyboard

Asset browsing

Do NOT attempt to make the full node editor equally comfortable on mobile.

On mobile:

view

inspect

run

simple edits

Desktop:

full node editing.

---

# 96. DESKTOP UX

Desktop is the primary environment for:

Workflow editor

Movie timeline

Advanced settings

Asset management

Administration

---

# 97. RESPONSIVE STACK

Frontend:

Bun

React

TypeScript

Bootstrap

Bootstrap Icons

Highcharts

No Tailwind.

Avoid unnecessary UI libraries.

---

# 98. DESIGN SYSTEM

Create reusable components:

Button

Modal

Drawer

Tabs

Card

Form

Select

FileUploader

ModelSelector

CostDisplay

AssetPicker

NodeCard

NodeEditor

Timeline

GenerationCard

TemplateCard

ProjectCard

StatusBadge

---

# 99. COST COMPONENT

Create:

<CostEstimate />

Example:

Estimated cost

RM0.48

Use it everywhere.

After execution:

<FinalCost />

Charged

RM0.51

---

# 100. ASSET COMPONENT

Every asset should have:

thumbnail

type

name

created date

project

model

generation

actions

Actions:

Open

Download

Use

Add to Workflow

Add to Project

Delete

---

# 101. GENERATION CARD

Generation card:

Preview

Status

Model

Prompt summary

Cost

Date

Actions:

Open

Regenerate

Edit

Use as Input

Save Template

Download

---

# 102. HISTORY

History should support:

All

Images

Videos

Audio

Text

Workflows

Movies

Filters:

project

model

date

status

cost

---

# 103. SEARCH

Global search should eventually search:

projects

assets

generations

templates

workflows

characters

scenes

shots

---

# 104. AUTHENTICATION

Authentication should support:

email

OAuth where appropriate

sessions

logout

account recovery

Do not expose secrets in browser storage unnecessarily.

---

# 105. API KEYS

API keys:

create

name

scope

expiration

revoke

last used

Never display full key after creation.

---

# 106. MCP TOKENS

Same principle.

Scopes:

models:read

generations:read

generations:write

workflows:read

workflows:execute

templates:read

templates:execute

assets:read

billing:read

---

# 107. RATE LIMITING

Rate-limit:

API

MCP

generation

workflow execution

file uploads

webhooks

Do not allow a malicious workflow to create unlimited expensive jobs.

---

# 108. WORKFLOW LIMITS

Prevent:

infinite loops

unbounded loops

excessive node execution

excessive file size

excessive parallel jobs

Set sensible defaults.

Advanced users can have higher limits.

---

# 109. SECURITY

Provider credentials must never reach browser clients.

Validate:

ownership

permissions

balance

model

input type

file ownership

workflow graph

template permissions

API scopes

MCP scopes

---

# 110. OBSERVABILITY

Every request receives:

requestId

Every generation:

generationId

Every workflow:

workflowRunId

Every node:

nodeRunId

Logs should allow tracing:

User

→ Workflow

→ Node

→ Provider

→ Result

---

# 111. AUDIT LOG

Record important events:

login

API key created

MCP token created

balance deposit

generation

workflow execution

template publication

asset deletion

permission change

---

# 112. ERROR MESSAGES

Bad:

"Generation failed."

Good:

"Video generation failed because the selected model does not support this resolution."

Provide:

Reason

Action

Retry

Change model

---

# 113. ACCESSIBILITY

Use:

semantic HTML

keyboard navigation

ARIA where appropriate

visible focus

proper labels

accessible forms

Do not rely exclusively on color.

---

# 114. PERFORMANCE

Do not load the entire node library immediately.

Lazy load:

node definitions

advanced controls

large asset thumbnails

movie timeline data

history pages

Use pagination.

---

# 115. LARGE FILES

Videos can be large.

Use:

R2

multipart upload where necessary

presigned URLs

background processing

Do not proxy huge files through the React application unnecessarily.

---

# 116. THUMBNAILS

Generate/store thumbnails where useful.

Movie assets should have:

thumbnail

preview

original

---

# 117. DATA MODEL PRINCIPLE

Separate:

definition

execution

result

Example:

Workflow:

definition

Workflow Run:

execution

Node Run:

execution step

Asset:

result

Generation:

provider execution

This separation is mandatory.

---

# 118. WORKFLOW IMMUTABILITY

When a workflow is executed:

record the exact workflow version.

Do not allow future edits to change historical execution semantics.

---

# 119. TEMPLATE EXECUTION

Template execution should create:

workflow run

using:

template version.

Store:

template version ID.

---

# 120. IDEMPOTENCY

Generation APIs should support idempotency keys.

If client retries the same request:

do not accidentally charge twice.

---

# 121. PAYMENT

The prepaid balance system must support:

deposit

payment provider integration

transaction ID

receipt

refund

balance update

Do not tightly couple AI execution to the payment gateway.

---

# 122. LOW BALANCE

Users can configure:

low balance warning.

Example:

"Your balance is below RM5."

Optionally:

automatic top-up

later feature.

---

# 123. ADMIN DASHBOARD

Admin sees:

Users

Revenue

Usage

Provider cost

Internal margin

Model popularity

Workflow executions

Failure rate

Storage

Queue

MCP usage

API usage

Unlike customer UI, admin can see internal pricing information.

---

# 124. ADMIN MODEL MANAGEMENT

Admin can:

enable model

disable model

change customer price

change internal markup

set limits

set availability

mark recommended

mark experimental

---

# 125. MODEL DISCOVERY

Do not require manually coding every new model.

Where Cloudflare exposes model metadata/API information, design the system so model catalog synchronization can update the registry.

However:

Never automatically expose an untested model to customers.

Use:

discovered

configured

enabled

deprecated

---

# 126. TESTING

Tests must cover:

cost estimation

balance

ledger

generation

workflow validation

node typing

workflow execution

retries

idempotency

template versioning

permissions

MCP

API

---

# 127. WORKFLOW VALIDATION

Before execution:

check:

missing inputs

invalid connections

missing model

unsupported parameter

cycle

unreachable output

permission

balance

Node configuration

Return all validation errors together where practical.

---

# 128. NODE SDK ARCHITECTURE

Node definitions should be serializable.

A node should conceptually have:

id

type

version

inputs

outputs

config

metadata

This makes workflows portable.

---

# 129. WORKFLOW JSON

A workflow must be representable as JSON.

Example concept:

{
"version": 1,
"nodes": [],
"edges": [],
"variables": []
}

This allows:

save

share

export

import

API

MCP

templates

---

# 130. WORKFLOW IMPORT/EXPORT

Eventually support:

Export JSON

Import JSON

Share workflow

Duplicate workflow

Publish template

This is important for developer users.

---

# 131. OPEN WORKFLOW FORMAT

Do not design workflow storage so tightly around React.

The workflow should be a backend/domain format.

React is simply one editor.

MCP and API can manipulate the same workflow representation.

---

# 132. NODE EXTENSIBILITY

Design node registry:

registerNode()

Nodes should eventually be pluggable.

Example:

registerNode({
type: "custom.http",
inputs: {},
outputs: {}
})

Do not implement arbitrary third-party code execution initially.

---

# 133. CODE NODE

A future Code Node may support:

JavaScript/TypeScript

But sandbox it.

Never execute arbitrary user code directly inside a normal Worker without an appropriate isolation model.

For MVP:

HTTP Node

Transform Node

JSON Node

Template Node

are sufficient.

---

# 134. HTTP NODE

Allow:

GET

POST

PUT

PATCH

DELETE

headers

query

body

authentication references

timeout

The UI should support simple configuration.

---

# 135. WEBHOOK NODE

Webhook trigger:

POST /hooks/:id

Workflow starts when request arrives.

Input becomes workflow variables.

Example:

Webhook
↓
Image Generator
↓
Video Generator
↓
Output

---

# 136. SCHEDULE NODE

Future:

run workflow:

once

hourly

daily

weekly

cron

Do not implement complex scheduling until the execution engine is stable.

---

# 137. MCP NODE

A workflow should eventually be able to call MCP tools.

Example:

Input

↓

MCP Tool

↓

AI Model

↓

Output

MCP is both:

external interface

and

workflow node capability.

---

# 138. AI AGENT NODE

Future node:

Agent

Inputs:

goal

context

tools

memory

budget

Outputs:

result

The agent must respect a maximum budget.

Example:

Maximum AI spend:

RM2.00

If projected usage exceeds:

stop.

---

# 139. BUDGET CONTROL

Workflow can specify:

maxCost

Example:

Movie Scene:

RM5 maximum.

If workflow attempts to exceed:

pause and ask user.

This is important for expensive movie workflows.

---

# 140. USER EXPERIENCE PRINCIPLE

Never make users think about infrastructure.

User thinks:

"I want this video."

not:

"Which queue is this using?"

Infrastructure remains invisible.

---

# 141. DEVELOPER EXPERIENCE

Developers should think:

"I can call a workflow."

not:

"I have to understand the entire RaisAI backend."

Example:

workflow.run()

is enough for common cases.

---

# 142. AI AGENT EXPERIENCE

An AI agent should think:

"I can call RaisAI to generate media."

MCP abstracts infrastructure.

---

# 143. CREATOR EXPERIENCE

A creator should think:

"I can make my movie here."

Movie mode hides complexity.

---

# 144. POWER USER EXPERIENCE

A power user should think:

"I can build anything."

Workflow mode exposes composition.

---

# 145. CORE PRODUCT LOOP

The most important loop:

Create

↓

Preview

↓

Estimate Cost

↓

Generate

↓

Review

↓

Modify

↓

Regenerate

↓

Reuse

↓

Share

This should feel extremely fast.

---

# 146. MOVIE PRODUCT LOOP

Movie:

Idea

↓

Story

↓

Characters

↓

Scenes

↓

Storyboard

↓

Shots

↓

Generate

↓

Review

↓

Regenerate

↓

Audio

↓

Timeline

↓

Export

---

# 147. FIRST MVP

Do NOT implement the entire movie studio first.

First create a strong vertical slice:

Authentication

*

Prepaid balance

*

Model registry

*

Image generation

*

Video generation where supported

*

R2 assets

*

Generation history

*

Cost estimate

*

Basic workflow editor

*

5-10 core nodes

*

Workflow execution

*

Template saving

That is the MVP.

---

# 148. MVP NODE TYPES

Implement:

Input Text

Input Image

Prompt

AI Model

Image Generator

Video Generator

Text Generator

Output

HTTP

Merge

These are enough to demonstrate the platform.

---

# 149. MVP WORKFLOW

Example:

[Prompt]
↓
[AI Image]
↓
[AI Video]
↓
[Output]

Then:

[Prompt]
↓
[LLM]
↓
[Image]
↓
[Video]
↓
[Output]

---

# 150. SECOND PHASE

Add:

Audio

TTS

Speech-to-text

Music

Image editing

Multi-image references

Model comparison

Workflow templates

Public templates

API

MCP

---

# 151. THIRD PHASE

Add:

Movie mode

Characters

Locations

Scenes

Storyboard

Shots

Timeline

Versioning

---

# 152. FOURTH PHASE

Add:

Node SDK

Webhooks

Automation

Agent nodes

Advanced collaboration

Marketplace

---

# 153. DEVELOPMENT PROCESS

Before coding:

1. Inspect current repository.
2. Inspect Open-Higgsfield-AI.
3. Inspect Cloudflare AI documentation/model catalog.
4. Understand current Cloudflare APIs and capabilities.
5. Produce architecture.
6. Implement vertical slice.
7. Test.
8. Continue feature by feature.

Cloudflare's official documentation should be treated as the source of truth for current Workers AI capabilities and model availability.

---

# 154. IMPORTANT: DO NOT ASSUME MODEL CAPABILITIES

Never assume:

"All models support image input."

Never assume:

"All video models support duration."

Never assume:

"All image models support 4K."

Read model metadata/capabilities.

The UI must adapt.

---

# 155. DO NOT HARDCODE PROVIDER LIMITATIONS INTO UI

Bad:

if flux then show X

Good:

if model.capabilities.includes("X")

---

# 156. CODE QUALITY

Prefer:

simple

typed

testable

modular

boring

maintainable

Do not create unnecessary enterprise abstractions.

---

# 157. CLOUDFLARE ARCHITECTURE

Preferred:

React frontend

Cloudflare Workers API

D1

R2

Queues

Workers AI

Optional:

KV

Durable Objects

AI Gateway

Use Durable Objects only where stateful coordination genuinely benefits from them.

Do not use every Cloudflare product simply because it exists.

---

# 158. FRONTEND ARCHITECTURE

Bun

React

TypeScript

Bootstrap

Highcharts

Use feature-oriented organization.

Example:

src/features/create

src/features/workflows

src/features/movies

src/features/templates

src/features/assets

src/features/billing

src/features/mcp

---

# 159. BACKEND ARCHITECTURE

Separate:

routes

controllers

services

repositories

providers

workflow engine

billing

storage

auth

MCP

---

# 160. APPLICATION SERVICES

Important services:

GenerationService

WorkflowService

WorkflowExecutionService

TemplateService

AssetService

BillingService

ModelService

MovieService

MCPService

WebhookService

---

# 161. SINGLE BUSINESS LOGIC

Do not duplicate:

generation

billing

workflow execution

permissions

model validation

between:

UI

API

MCP

SDK

They all call the same backend services.

---

# 162. FINAL PRODUCT VISION

RaisAI Create should eventually allow this:

A user opens the application.

Clicks:

"Create Movie"

Types:

"Create a 10-minute cyberpunk detective story set in Kuala Lumpur."

RaisAI generates:

story

characters

locations

scenes

shots

storyboard

Then the user clicks:

Generate Storyboard

Then:

Generate Shots

Then:

Generate Video

Then:

Generate Voices

Then:

Generate Music

Then:

Build Timeline

Then:

Export Movie.

Underneath:

the system is executing workflows.

The user does not need to understand the node graph.

An advanced user can open:

Workflow

and see the entire pipeline.

A developer can call:

API.

An AI agent can call:

MCP.

A creator can publish:

Template.

A Node.js developer can call:

Node SDK.

---

# 163. THE MOST IMPORTANT UX RULE

**Complexity should be progressive.**

Level 1:

Create

Level 2:

Advanced settings

Level 3:

Workflow

Level 4:

API/MCP

Level 5:

Developer/automation

Never force level-5 complexity onto level-1 users.

---

# 164. THE MOST IMPORTANT BUSINESS RULE

Customer sees:

Balance

Estimated Cost

Final Charged Cost

Nothing else about internal provider economics.

Internal system tracks:

providerCost

markup

margin

providerRequest

actualUsage

This information is for administration and accounting only.

---

# 165. THE MOST IMPORTANT TECHNICAL RULE

The workflow engine is the heart of RaisAI Create.

Not React.

Not the image generator.

Not the movie editor.

The workflow engine.

Everything should eventually be able to use it:

Web UI

Movie Mode

Templates

API

MCP

Node SDK

Automation

Agents

---

# 166. FINAL ARCHITECTURE

```
                 RAISAI CREATE
                       │
      ┌────────────────┼────────────────┐
      │                │                │
    WEB UI           API              MCP
      │                │                │
      └────────────────┼────────────────┘
                       │
              APPLICATION SERVICES
                       │
          ┌────────────┼────────────┐
          │            │            │
      WORKFLOW       BILLING      ASSETS
       ENGINE
          │
   ┌──────┼───────────────┐
   │      │               │
  AI     HTTP            MCP
 NODES   NODES           NODES
   │
   ▼
```

PROVIDER ABSTRACTION
│
▼
CLOUDFLARE AI

Supporting:

D1
R2
Queues
Authentication
Webhooks
Usage
Templates
Projects
Movies

---

# 167. FINAL INSTRUCTION TO CLAUDE

Do not attempt to implement everything at once.

Build the platform incrementally.

At every phase:

* keep the application runnable
* keep migrations clean
* keep APIs typed
* keep UI usable
* test billing
* test workflow execution
* test model capability handling
* test failure recovery

Before adding a major subsystem, explain:

1. Why it is needed.
2. Where it belongs.
3. What existing interfaces it affects.
4. How it will remain extensible.

Never sacrifice the simple user experience merely because the backend is powerful.

The goal is:

**A beginner can create an image in 30 seconds.**

**A creator can build a movie.**

**A power user can build a complex workflow.**

**A developer can call it through API.**

**An AI agent can control it through MCP.**

**A Node.js developer can automate it.**

All of them are using the SAME underlying RaisAI Create platform.
