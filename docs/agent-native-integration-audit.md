# Agent Native integration audit

Reviewed 2026-09-11 against **Core 0.133.1** and **Toolkit 0.12.1**, the versions installed in this checkout. The audit inventories all **161 installed documentation topics**, reviews their applicability, and checks the relevant public APIs against packaged source. It also compares the current official documentation navigation. This is a catalog-wide integration review, not a claim that every example or external service was executed.

The version-matched documentation lives in `node_modules/@agent-native/core/docs/content/`; runtime and template reference sources are packaged alongside it. The online docs have additional, newer pages and subdivided deployment/API guides. Newer APIs must be checked against installed exports before use. No framework upgrade or new framework patch was introduced.

## Changes made

| Integration gap                                          | Result                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `view-screen` returned only navigation IDs               | It now reads fresh, access-checked project context, including selected row/choice/addon prose, scores and requirements. `get-project-context` provides the same bounded read to agents and integrations. Images and siblings are omitted; truncated content is marked.                           |
| Visual selection was local React state                   | Row/choice selection is URL state. Deep links, reloads, mode changes and agent navigation open the inspector. The existing route-state hook also makes the selection visible to the agent.                                                                                                       |
| Routine agent reads requested entire large documents     | Initial tools and author instructions prefer compact context and structure reads. Full `get-project` remains available when exact data is needed. Its external link now targets `/projects/:id/editor`.                                                                                          |
| No domain `@` references                                 | The Projects mention provider calls `search-projects`, selecting only IDs/titles, bounded to eight results for mentions and scoped by Core access filtering.                                                                                                                                     |
| History and review rejected invited collaborators        | Removed the custom owner/public-only resolvers. Both adapters inherit Core's existing project sharing and organization checks.                                                                                                                                                                   |
| History had actions but no UI                            | Editor → Project → History saves named checkpoints and confirms restore. The UI saves a backup first. The restore adapter validates the document and saves JSON/metadata together through the conditional save and blob boundary.                                                                |
| Review had actions but no UI                             | Editor → Project → Review supports anchored comments, replies, resolution, deletion capabilities and an explicit **Queue for agent** action. The agent can read queued feedback with `get-review-feedback`. Queuing does not start an agent run; use **Ask agent** to request work on the queue. |
| “What changed” searched private execution-ledger text    | `list-project-changes` now uses Core's exact resource audit API and caller/org scope. Thirty-seven project mutation actions declare a resource audit target and omit potentially large inputs from audit storage. UI edits are included as well as agent edits.                                  |
| Import progress had no visible tray                      | Mounted Core's `RunsTray` next to notifications. It is hidden when idle; notifications remain immediately before Share on project pages. The removed global header stays removed.                                                                                                                |
| Global filesystem MCP used an obsolete checkout path     | Removed the broken deployment-wide server. `mcp.config.json` is intentionally empty. Local browser tools and scoped MCP connections remain available in Settings; SQL/uploads stay behind project actions.                                                                                       |
| An unused Yjs endpoint could overwrite action-saved JSON | Removed the server-only collab plugin. Core DB sync still propagates saved changes. A real CRDT/presence feature needs a coordinated client/action lifecycle before mounting another document writer.                                                                                            |
| Missing repeatable catalog diagnostic                    | Added `pnpm guard:i18n-catalogs` and `pnpm doctor`. New history copy is in all eleven locale catalogs. Removed the obsolete package-level pnpm build allowlist; the existing workspace `allowBuilds` remains authoritative.                                                                      |

These follow the framework's [context contract](https://www.agent-native.com/docs/context-awareness/), [resource history](https://www.agent-native.com/docs/toolkit-history/), [review model](https://www.agent-native.com/docs/toolkit-comments-review/) and [action audit API](https://www.agent-native.com/docs/audit-log/). App-owned components compose public hooks and UI adapters; framework runtime internals were not copied.

## Existing integrations retained

- **One action surface:** Zod-defined project actions, React query/mutation hooks, generated registry, HTTP/CLI and agent transports. Core query client and `useDbSync` share saved state across tabs. Domain data stays out of custom REST endpoints.
- **Native agent UX:** durable chat, sidebar/fullscreen handoff, composer/context tools, model selection, attachments, voice settings, approval/recovery infrastructure and SQL-backed resources. Core handles these surfaces; app code supplies CYOA actions and context.
- **Authoring resources:** CYOA author persona and domain skills, planning actions with revision checks, native project/structure data-table results, sandboxed extensions and generative UI.
- **Governance:** Better Auth, organizations/team settings, share controls, scoped project access, standard settings search and encrypted provider-secret flows. External connector reads require authentication; writes use the app-agent policy.
- **Operations:** observability, feedback/eval infrastructure, notifications and import progress. Custom DeepSeek registration and the final-response evidence guard remain in place.
- **Media:** Core's file-upload provider interface with local disk storage and URL references in project JSON. Persistent hosting must provide a durable volume or another blob provider.

## Useful features that need additional setup or a separate implementation

| Feature                                                                | Applicability and boundary                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Live Yjs editing, presence, cursors, collaborative undo                | Useful for simultaneous authors. Deferred because forms currently save whole JSON through actions. Requires shared Yjs lifecycle, action reconciliation and concurrent-edit tests; mounting a plugin alone does not deliver collaboration.                   |
| Messaging: Slack, email, Telegram, WhatsApp, Discord, Teams            | The integrations plugin is mounted. Requires platform credentials and verified callbacks. No account was connected and no external message was sent during this audit.                                                                                       |
| External MCP/A2A/HTTP clients and MCP Apps                             | Server/connector infrastructure is configured. Hosted access needs its authentication and reachable deployment; inline MCP App experiences need explicit artifact routes and host validation. Canonical project links work without building a second viewer. |
| Automations, scheduled jobs, workflow connectors                       | Available in Core settings/tools. Useful for requested review reminders or project checks, but no schedules or external callbacks were created implicitly. A deploy scheduler and model/provider configuration must be verified.                             |
| Durable background execution                                           | Existing option retained. Actual background workers depend on hosting, particularly the documented Netlify worker setup and authentication. Local browser tests do not validate hosted background recovery.                                                  |
| Agent evals                                                            | The two existing CYOA eval cases and runner remain available. Live model evals were not run. Run against isolated test data with a configured provider; tool-name/text scorers alone do not prove a balanced, correct CYOA.                                  |
| Assets/Design/Brain/Content/Plan sibling apps                          | Potentially useful for art generation, style references, lore, or reviewable plans. Their templates are reference patterns, not installed integrations. Connect via scoped workspace/MCP/A2A only when those apps actually exist.                            |
| Builder connect, OAuth and managed providers                           | Standard setup surfaces retained. Provider readiness depends on the chosen user's/org's credentials; plugin presence is not evidence that a provider works.                                                                                                  |
| Production database, media and auth                                    | Local SQLite/disk configuration is not a serverless storage strategy. Production needs durable SQL/blob storage and stable auth/encryption secrets. No deployment was performed.                                                                             |
| Public crawling, markdown mirrors, JSON-LD                             | Could support a future public CYOA catalog. Do not make private editor/project content crawlable merely to enable a documentation feature.                                                                                                                   |
| Typed shared config, Portal, WebMCP                                    | Additional topics in current online docs. The installed release is the compatibility boundary; typed config/WebMCP examples from newer docs were not copied into an older runtime. Portal requires a workspace product/deployment decision.                  |
| Harnesses, CLI/sandbox adapters, data programs and capability packages | Core exposes extension seams, but there is no concrete CYOA workflow requiring another coding harness, analytics runtime, or package installation here. Use the existing action surface first.                                                               |

Current online documentation describes a [typed shared configuration file](https://www.agent-native.com/docs/agent-native-config/) and [WebMCP](https://www.agent-native.com/docs/webmcp/). Their presence online is not evidence that this pinned version exposes their APIs. The installed docs/source are authoritative for these changes.

## Validation and limits

- **779 tests passed in 33 files**, including compact context, inaccessible/stale selections, exact audit scoping, invalid snapshot rejection, conditional restore, copy ownership and locale key/placeholder checks. `pnpm typecheck` passed.
- Browser tests passed for selection deep links/reload, save checkpoint, confirmed restore with backup, restored content, anchored comments, agent queue/resolution, UI audit events and project search.
- Two local test users verified private-project isolation, mention-search privacy, invited viewer/editor history permissions, editor restore/review and revocation. Test sharing used `notify: false`; temporary projects were deleted.
- **All nine Doctor guards now pass with zero findings or warnings.** The earlier 14 findings were addressed in a follow-up: local verification scripts take explicit CLI arguments, and DeepSeek tests use `vi.stubEnv` with per-test cleanup instead of reading/mutating process environment manually.
- Two narrow, documented `guard:allow-env-credential` exceptions remain: `FILE_UPLOADS_DIR` is deployment storage configuration, and the DeepSeek deployment-key default is explicitly authorized by the app's Model Providers contract. Scoped keys take precedence and Core's `allowEnvFallback` gate still controls fallback. No guard was disabled globally.
- Project duplication now assigns a private copy to the caller and the caller's active organization, rather than preserving the source owner. Regression tests cover shared sources, personal copies, missing identity and denied source access. The local copy helper invokes the standard action through the framework CLI, removes the hardcoded source ID, and no longer deletes or replaces rows with direct SQL.
- Existing framework dependency patching for DeepSeek context capacity was preserved as an app-specific exception. It remains an upgrade maintenance obligation.
- Older audit records without resource labels are not backfilled. Core audit visibility remains scoped to the caller/organization; resource access alone does not expose every collaborator's private agent trace.
- Checkpoints contain saved changes, not unsaved form drafts. The History UI makes a backup before restore; direct Core restore calls do not automatically create that UI backup. No claim of collaborative undo or transactional backup-plus-restore is made.
- The locale guard verifies keys and interpolation. Existing English fallback sections remain; it is not a translation-quality review. Provider calls, paid evals, hosted MCP clients and production deployment behavior remain unverified.

## Complete installed documentation catalog

Each topic below was considered for relevance. “Retained” means the app uses the applicable Core/Toolkit surface; “Changed” identifies an integration corrected in this audit; “Conditional” requires configuration or further product work; “Reference” is a template, conceptual or development guide rather than a feature to switch on. Detailed API/source inspection focused on the integrations changed above and their access/runtime contracts.

| Documentation topic                                                                                                                       | Disposition | C-CAN application                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| [A2A Protocol](https://www.agent-native.com/docs/a2a-protocol/)                                                                           | Conditional | Configured app-agent infrastructure; hosted authenticated peers need setup.           |
| [Actions](https://www.agent-native.com/docs/actions/)                                                                                     | Retained    | Shared schema/action boundary; new context/search actions and audit targets.          |
| [Agent Mentions](https://www.agent-native.com/docs/agent-mentions/)                                                                       | Changed     | Scoped project mention provider and metadata-only search.                             |
| [Toolkit](https://www.agent-native.com/docs/agent-native-toolkit/)                                                                        | Retained    | Use public UI/controller seams instead of copying runtimes.                           |
| [Agent Resources](https://www.agent-native.com/docs/agent-resources/)                                                                     | Retained    | Core SQL-backed instructions, memory, skills and settings.                            |
| [Agent Surfaces](https://www.agent-native.com/docs/agent-surfaces/)                                                                       | Retained    | Fullscreen and sidebar chat, app pages and external action surface.                   |
| [Agent Teams](https://www.agent-native.com/docs/agent-teams/)                                                                             | Retained    | Existing CYOA Author persona; no new delegation workflow created.                     |
| [Public Agent Web](https://www.agent-native.com/docs/agent-web-surfaces/)                                                                 | Conditional | Public catalog/crawling is a future publishing feature; keep private content private. |
| [Audit Log](https://www.agent-native.com/docs/audit-log/)                                                                                 | Changed     | Resource targets on project mutations; exact scoped audit reads.                      |
| [Authentication](https://www.agent-native.com/docs/authentication/)                                                                       | Retained    | Better Auth and guarded private project data.                                         |
| [Workflow Connectors](https://www.agent-native.com/docs/automation-connectors/)                                                           | Conditional | External n8n/Zapier callbacks require a specific workflow and credentials.            |
| [Automations](https://www.agent-native.com/docs/automations/)                                                                             | Conditional | Standard tools/settings available; no implicit schedules or callbacks created.        |
| [Blueprint Installer](https://www.agent-native.com/docs/blueprint-installer/)                                                             | Reference   | No package installation required; public composition was sufficient.                  |
| [CLI Adapters](https://www.agent-native.com/docs/cli-adapters/)                                                                           | Conditional | No additional CLI-backed domain operation identified.                                 |
| [Client](https://www.agent-native.com/docs/client/)                                                                                       | Retained    | AppProviders, Core query client, typed hooks and DB sync.                             |
| [Templates](https://www.agent-native.com/docs/cloneable-saas/)                                                                            | Reference   | Template selection reference, not an extra runtime feature.                           |
| [Agent-Native Code UI](https://www.agent-native.com/docs/code-agents-ui/)                                                                 | Reference   | A coding-agent desktop surface is outside CYOA editing.                               |
| [Component API](https://www.agent-native.com/docs/components/)                                                                            | Retained    | Core history/review/progress and chat components/hooks.                               |
| [Context Awareness](https://www.agent-native.com/docs/context-awareness/)                                                                 | Changed     | Fresh compact context and URL-owned visual selection.                                 |
| [Creating Templates](https://www.agent-native.com/docs/creating-templates/)                                                               | Reference   | This task does not publish a new reusable template.                                   |
| [Cross-App SSO](https://www.agent-native.com/docs/cross-app-sso/)                                                                         | Conditional | Standalone app; no Dispatch identity authority configured.                            |
| [Custom Design Systems](https://www.agent-native.com/docs/custom-design-system/)                                                          | Retained    | Configured local adapter seam retained; no replacement design system needed.          |
| [Data Programs](https://www.agent-native.com/docs/data-programs/)                                                                         | Conditional | No analytics/dashboard data-program workflow required.                                |
| [Database](https://www.agent-native.com/docs/database/)                                                                                   | Retained    | Portable schema/helpers; existing local SQL configuration.                            |
| [Deployment](https://www.agent-native.com/docs/deployment/)                                                                               | Conditional | No deployment; durable database/media and stable secrets required.                    |
| [Dispatch](https://www.agent-native.com/docs/dispatch/)                                                                                   | Conditional | Would require deployed sibling control plane and scoped connections.                  |
| [Docs components](https://www.agent-native.com/docs/docs-components/)                                                                     | Reference   | Documentation-site authoring components, not CYOA runtime UI.                         |
| [Doctor (Code Checks)](https://www.agent-native.com/docs/doctor/)                                                                         | Changed     | All nine guards pass; two narrowly documented deployment exceptions.                  |
| [Drop-in Agent](https://www.agent-native.com/docs/drop-in-agent/)                                                                         | Retained    | Existing sidebar/fullscreen handoff retained.                                         |
| [Durable Background Runs](https://www.agent-native.com/docs/durable-background-runs/)                                                     | Conditional | Existing option retained; requires appropriate authenticated hosted worker.           |
| [Durable Resume](https://www.agent-native.com/docs/durable-resume/)                                                                       | Retained    | Keep Core journaling/recovery; no custom replay loop.                                 |
| [Embedding SDK](https://www.agent-native.com/docs/embedding-sdk/)                                                                         | Conditional | No host SaaS embedding requirement; existing app/sidebar retained.                    |
| [CI Eval Gate](https://www.agent-native.com/docs/evals/)                                                                                  | Conditional | Existing CYOA cases retained; paid model runs not executed.                           |
| [Extensions](https://www.agent-native.com/docs/extensions/)                                                                               | Retained    | Both plugins enable extension tooling; dedicated routes exist.                        |
| [External Agents: Catalog & Developer Reference](https://www.agent-native.com/docs/external-agents-catalog/)                              | Conditional | Compact read added and canonical project links; external hosts unverified.            |
| [External Agents: Claude, ChatGPT, Codex, Cursor, Cowork](https://www.agent-native.com/docs/external-agents/)                             | Conditional | Configured authenticated catalog and app-only write policy; hosts unverified.         |
| [FAQ](https://www.agent-native.com/docs/faq/)                                                                                             | Reference   | Conceptual/product reference.                                                         |
| [File Uploads](https://www.agent-native.com/docs/file-uploads/)                                                                           | Retained    | Local provider/blob boundary retained and reused on restore.                          |
| [Frames](https://www.agent-native.com/docs/frames/)                                                                                       | Reference   | Existing local/embedded agent host; no additional frame implemented.                  |
| [Generative UI](https://www.agent-native.com/docs/generative-ui/)                                                                         | Retained    | Core sandboxed generation infrastructure retained.                                    |
| [Getting Started](https://www.agent-native.com/docs/getting-started/)                                                                     | Reference   | Existing app uses the Chat scaffold; no res scaffolding needed.                       |
| [Harness Agents](https://www.agent-native.com/docs/harness-agents/)                                                                       | Conditional | No need for another coding harness to perform CYOA actions.                           |
| [HTTP API: Call Actions from Anything](https://www.agent-native.com/docs/http-api/)                                                       | Conditional | Core action HTTP transport used; no new bearer credentials issued.                    |
| [Human-in-the-Loop Approvals](https://www.agent-native.com/docs/human-approval/)                                                          | Conditional | Keep Core capability for consequential operations; no new save approval gates.        |
| [Integrations Directory](https://www.agent-native.com/docs/integrations/)                                                                 | Conditional | Scoped settings/connectors available; account configuration required.                 |
| [Internationalization](https://www.agent-native.com/docs/internationalization/)                                                           | Changed     | New locale messages and a repeatable key/placeholder guard.                           |
| [Key Concepts](https://www.agent-native.com/docs/key-concepts/)                                                                           | Reference   | Core/Toolkit/template boundaries applied.                                             |
| [Local folder sources](https://www.agent-native.com/docs/local-file-mode/)                                                                | Reference   | Content-template Markdown sync is not ICCPlus JSON import.                            |
| [MCP Apps](https://www.agent-native.com/docs/mcp-apps/)                                                                                   | Conditional | Canonical routes ready for links; no dedicated host-embedded artifact UI added.       |
| [MCP Clients](https://www.agent-native.com/docs/mcp-clients/)                                                                             | Changed     | Removed broken global filesystem server; scoped connections remain available.         |
| [MCP Server](https://www.agent-native.com/docs/mcp-protocol/)                                                                             | Conditional | Core server retained; hosted client authentication/network need verification.         |
| [Messaging Internals](https://www.agent-native.com/docs/messaging-internals/)                                                             | Conditional | Use Core identity/webhook lifecycle; no external messaging tested.                    |
| [Messaging Recipes: Slack to Notion](https://www.agent-native.com/docs/messaging-recipes/)                                                | Conditional | No Slack-to-Notion workflow requested; reference only.                                |
| [Messaging](https://www.agent-native.com/docs/messaging/)                                                                                 | Conditional | Plugin mounted; platform credentials/callback verification required.                  |
| [Multi-App Workspaces](https://www.agent-native.com/docs/multi-app-workspace/)                                                            | Conditional | Standalone checkout; do not restructure into a workspace implicitly.                  |
| [Multi-Tenancy](https://www.agent-native.com/docs/multi-tenancy/)                                                                         | Retained    | Core user/org identity and project ownership columns.                                 |
| [Native Chat UI](https://www.agent-native.com/docs/native-chat-ui/)                                                                       | Retained    | Existing native data tables; verified result shape against renderer source.           |
| [Notifications](https://www.agent-native.com/docs/notifications/)                                                                         | Retained    | Core bell retained, adjacent to Share; no external channels enabled.                  |
| [Observability](https://www.agent-native.com/docs/observability/)                                                                         | Retained    | Existing observability route and Core instrumentation.                                |
| [Observational Memory](https://www.agent-native.com/docs/observational-memory/)                                                           | Retained    | Keep Core default compaction; no competing memory implementation.                     |
| [Onboarding & API Keys](https://www.agent-native.com/docs/onboarding/)                                                                    | Retained    | Standard setup surfaces; scoped DeepSeek readiness remains configured.                |
| [Organizations, Teams & Permissions](https://www.agent-native.com/docs/organizations-teams-permissions/)                                  | Retained    | Core team/settings and shared resource roles.                                         |
| [Package Lifecycle](https://www.agent-native.com/docs/package-lifecycle/)                                                                 | Reference   | Pinned compatibility reviewed; existing patch must be revisited on upgrade.           |
| [Plan plugin & marketplace](https://www.agent-native.com/docs/plan-plugin/)                                                               | Conditional | Optional planning plugin; current app already has CYOA planning.                      |
| [PR Visual Recap](https://www.agent-native.com/docs/pr-visual-recap/)                                                                     | Conditional | Optional external PR automation; not installed or published.                          |
| [In-Loop Processors](https://www.agent-native.com/docs/processors/)                                                                       | Retained    | Existing final-response guard; HTTP processor seam unavailable in this version.       |
| [Progress](https://www.agent-native.com/docs/progress/)                                                                                   | Changed     | RunsTray now exposes existing import progress.                                        |
| [Automation-First Apps](https://www.agent-native.com/docs/pure-agent-apps/)                                                               | Reference   | C-CAN needs its interactive viewer/editor; keep its UI.                               |
| [Real-Time Collaboration](https://www.agent-native.com/docs/real-time-collaboration/)                                                     | Changed     | Removed unpaired document writer; DB sync retained; CRDT work deferred.               |
| [Recurring Jobs](https://www.agent-native.com/docs/recurring-jobs/)                                                                       | Conditional | No scheduled CYOA job requirement; needs deployed scheduler/model setup.              |
| [Routing](https://www.agent-native.com/docs/routing/)                                                                                     | Changed     | Canonical project resources and URL selection.                                        |
| [Adapters](https://www.agent-native.com/docs/sandbox-adapters/)                                                                           | Conditional | Keep Core defaults; no alternate sandbox backend required.                            |
| [Security](https://www.agent-native.com/docs/security/)                                                                                   | Retained    | Project ACLs, scoped secrets, copy ownership; Doctor exceptions recorded.             |
| [Server](https://www.agent-native.com/docs/server/)                                                                                       | Retained    | Core/Nitro plugins, generated action registry and request context.                    |
| [Sharing & Privacy](https://www.agent-native.com/docs/sharing/)                                                                           | Retained    | Project resource and canonical playable Share links.                                  |
| [Skills Guide](https://www.agent-native.com/docs/skills-guide/)                                                                           | Retained    | Existing domain/framework skills, with version-matched lookup.                        |
| [Syncing Template Changes](https://www.agent-native.com/docs/syncing-template-changes/)                                                   | Reference   | No upstream template merge requested; preserve local modifications.                   |
| [Analytics: Connecting and Extending Data Sources](https://www.agent-native.com/docs/template-analytics-connectors/)                      | Reference   | Separate dashboard/monitoring product; Core observability is already available.       |
| [Analytics: Dashboards, Analyses, and the Data Dictionary](https://www.agent-native.com/docs/template-analytics-dashboards/)              | Reference   | Separate dashboard/monitoring product; Core observability is already available.       |
| [Analytics: Extending the Template](https://www.agent-native.com/docs/template-analytics-developers/)                                     | Reference   | Separate dashboard/monitoring product; Core observability is already available.       |
| [Analytics: Monitoring, Errors, and Session Replay](https://www.agent-native.com/docs/template-analytics-monitoring-and-sessions/)        | Reference   | Separate dashboard/monitoring product; Core observability is already available.       |
| [Analytics](https://www.agent-native.com/docs/template-analytics/)                                                                        | Reference   | Separate dashboard/monitoring product; Core observability is already available.       |
| [Assets — architecture and data model](https://www.agent-native.com/docs/template-assets-developers/)                                     | Reference   | Potential art service/picker; requires actual Assets deployment/provider setup.       |
| [Generating, refining, and reviewing assets](https://www.agent-native.com/docs/template-assets-generation/)                               | Reference   | Potential art service/picker; requires actual Assets deployment/provider setup.       |
| [Using Assets from other apps and agents](https://www.agent-native.com/docs/template-assets-integrations/)                                | Reference   | Potential art service/picker; requires actual Assets deployment/provider setup.       |
| [Presets: design once, run everywhere](https://www.agent-native.com/docs/template-assets-presets/)                                        | Reference   | Potential art service/picker; requires actual Assets deployment/provider setup.       |
| [Assets](https://www.agent-native.com/docs/template-assets/)                                                                              | Reference   | Potential art service/picker; requires actual Assets deployment/provider setup.       |
| [Brain: Talking to the Agent & Cross-App Use](https://www.agent-native.com/docs/template-brain-agent/)                                    | Reference   | Potential lore/knowledge integration; no knowledge service connected.                 |
| [Brain: Developer Guide](https://www.agent-native.com/docs/template-brain-developers/)                                                    | Reference   | Potential lore/knowledge integration; no knowledge service connected.                 |
| [Brain: Asking, Citations & Knowledge](https://www.agent-native.com/docs/template-brain-knowledge/)                                       | Reference   | Potential lore/knowledge integration; no knowledge service connected.                 |
| [Brain: Connecting & Reviewing Sources](https://www.agent-native.com/docs/template-brain-sources/)                                        | Reference   | Potential lore/knowledge integration; no knowledge service connected.                 |
| [Brain](https://www.agent-native.com/docs/template-brain/)                                                                                | Reference   | Potential lore/knowledge integration; no knowledge service connected.                 |
| [Calendar: Talking to the Agent](https://www.agent-native.com/docs/template-calendar-agent/)                                              | Reference   | Scheduling/booking product outside current CYOA authoring.                            |
| [Calendar: Booking Links](https://www.agent-native.com/docs/template-calendar-booking-links/)                                             | Reference   | Scheduling/booking product outside current CYOA authoring.                            |
| [Calendar: Developer Guide](https://www.agent-native.com/docs/template-calendar-developers/)                                              | Reference   | Scheduling/booking product outside current CYOA authoring.                            |
| [Calendar: Events, Availability & Finding Time](https://www.agent-native.com/docs/template-calendar-scheduling/)                          | Reference   | Scheduling/booking product outside current CYOA authoring.                            |
| [Calendar](https://www.agent-native.com/docs/template-calendar/)                                                                          | Reference   | Scheduling/booking product outside current CYOA authoring.                            |
| [Chat — runtime and admin surfaces](https://www.agent-native.com/docs/template-chat-developers/)                                          | Reference   | Current scaffold; durable chat, actions, routes and settings retained.                |
| [Your first feature in Chat](https://www.agent-native.com/docs/template-chat-first-edits/)                                                | Reference   | Current scaffold; durable chat, actions, routes and settings retained.                |
| [Chat Template](https://www.agent-native.com/docs/template-chat/)                                                                         | Reference   | Current scaffold; durable chat, actions, routes and settings retained.                |
| [AI Pipeline, Editing, and Insights](https://www.agent-native.com/docs/template-clips-ai-and-editing/)                                    | Reference   | Recording/transcription product outside current CYOA authoring.                       |
| [Capturing Everywhere: Desktop, Mobile, and Screen Memory](https://www.agent-native.com/docs/template-clips-capture-everywhere/)          | Reference   | Recording/transcription product outside current CYOA authoring.                       |
| [Extending Clips](https://www.agent-native.com/docs/template-clips-developers/)                                                           | Reference   | Recording/transcription product outside current CYOA authoring.                       |
| [Sharing, Teams, and Agent-Readable Clips](https://www.agent-native.com/docs/template-clips-sharing-and-teams/)                           | Reference   | Recording/transcription product outside current CYOA authoring.                       |
| [Clips](https://www.agent-native.com/docs/template-clips/)                                                                                | Reference   | Recording/transcription product outside current CYOA authoring.                       |
| [Content: Databases, Properties & Forms](https://www.agent-native.com/docs/template-content-databases/)                                   | Reference   | Reference for editorial/review workflows; no Notion/MDX synchronization required.     |
| [Content: Developer Guide](https://www.agent-native.com/docs/template-content-developers/)                                                | Reference   | Reference for editorial/review workflows; no Notion/MDX synchronization required.     |
| [Content: Writing & Organizing Documents](https://www.agent-native.com/docs/template-content-editing/)                                    | Reference   | Reference for editorial/review workflows; no Notion/MDX synchronization required.     |
| [Content: Local Files, Notion & Builder CMS Sync](https://www.agent-native.com/docs/template-content-sync/)                               | Reference   | Reference for editorial/review workflows; no Notion/MDX synchronization required.     |
| [Content](https://www.agent-native.com/docs/template-content/)                                                                            | Reference   | Reference for editorial/review workflows; no Notion/MDX synchronization required.     |
| [Brand Systems and Figma](https://www.agent-native.com/docs/template-design-brand-and-figma/)                                             | Reference   | Reference for visual selection/review; no HTML prototype service installed.           |
| [Review, Handoff, and Full Apps](https://www.agent-native.com/docs/template-design-collaboration-and-full-apps/)                          | Reference   | Reference for visual selection/review; no HTML prototype service installed.           |
| [Extending Design](https://www.agent-native.com/docs/template-design-developers/)                                                         | Reference   | Reference for visual selection/review; no HTML prototype service installed.           |
| [Quality Passes and Components](https://www.agent-native.com/docs/template-design-quality-and-components/)                                | Reference   | Reference for visual selection/review; no HTML prototype service installed.           |
| [Design](https://www.agent-native.com/docs/template-design/)                                                                              | Reference   | Reference for visual selection/review; no HTML prototype service installed.           |
| [Dispatch — architecture for developers](https://www.agent-native.com/docs/template-dispatch-developers/)                                 | Reference   | Optional workspace control plane; standalone app retained.                            |
| [Messaging, routing, and approvals](https://www.agent-native.com/docs/template-dispatch-messaging-routing/)                               | Reference   | Optional workspace control plane; standalone app retained.                            |
| [Operating the workspace: automations, Dreams, and the operator console](https://www.agent-native.com/docs/template-dispatch-operations/) | Reference   | Optional workspace control plane; standalone app retained.                            |
| [Secrets, integrations, and workspace connections](https://www.agent-native.com/docs/template-dispatch-vault-integrations/)               | Reference   | Optional workspace control plane; standalone app retained.                            |
| [Dispatch](https://www.agent-native.com/docs/template-dispatch/)                                                                          | Reference   | Optional workspace control plane; standalone app retained.                            |
| [Building and publishing a form](https://www.agent-native.com/docs/template-forms-building-publishing/)                                   | Reference   | Form publishing/intake product outside current CYOA authoring.                        |
| [Forms — data model and actions](https://www.agent-native.com/docs/template-forms-developers/)                                            | Reference   | Form publishing/intake product outside current CYOA authoring.                        |
| [Forms — responses, insights, and destinations](https://www.agent-native.com/docs/template-forms-responses/)                              | Reference   | Form publishing/intake product outside current CYOA authoring.                        |
| [Forms](https://www.agent-native.com/docs/template-forms/)                                                                                | Reference   | Form publishing/intake product outside current CYOA authoring.                        |
| [Mail: Talking to the Agent](https://www.agent-native.com/docs/template-mail-agent/)                                                      | Reference   | Gmail/send workflows not required for CYOA editing.                                   |
| [Mail: Developer Guide](https://www.agent-native.com/docs/template-mail-developers/)                                                      | Reference   | Gmail/send workflows not required for CYOA editing.                                   |
| [Mail: Drafting, Scheduling & the Draft Queue](https://www.agent-native.com/docs/template-mail-drafts-and-queue/)                         | Reference   | Gmail/send workflows not required for CYOA editing.                                   |
| [Mail: Inbox, Search & Automations](https://www.agent-native.com/docs/template-mail-inbox/)                                               | Reference   | Gmail/send workflows not required for CYOA editing.                                   |
| [Mail](https://www.agent-native.com/docs/template-mail/)                                                                                  | Reference   | Gmail/send workflows not required for CYOA editing.                                   |
| [Events and Automations](https://www.agent-native.com/docs/template-plan-automations/)                                                    | Reference   | Reference for feedback queues; CYOA planning stays in app actions.                    |
| [Extending Plan](https://www.agent-native.com/docs/template-plan-developers/)                                                             | Reference   | Reference for feedback queues; CYOA planning stays in app actions.                    |
| [Local-Files Mode and Desktop Sync](https://www.agent-native.com/docs/template-plan-local-and-desktop/)                                   | Reference   | Reference for feedback queues; CYOA planning stays in app actions.                    |
| [Reviewing and Commenting on Plans](https://www.agent-native.com/docs/template-plan-review-workflow/)                                     | Reference   | Reference for feedback queues; CYOA planning stays in app actions.                    |
| [Visual Plans](https://www.agent-native.com/docs/template-plan/)                                                                          | Reference   | Reference for feedback queues; CYOA planning stays in app actions.                    |
| [Slides: Talking to the Agent & Creative Context](https://www.agent-native.com/docs/template-slides-agent/)                               | Reference   | Reference for visual editing/history; slide generation is a separate product.         |
| [Slides: Design Systems & Media](https://www.agent-native.com/docs/template-slides-design-and-media/)                                     | Reference   | Reference for visual editing/history; slide generation is a separate product.         |
| [Slides: Developer Guide](https://www.agent-native.com/docs/template-slides-developers/)                                                  | Reference   | Reference for visual editing/history; slide generation is a separate product.         |
| [Slides: Generating & Editing Decks](https://www.agent-native.com/docs/template-slides-editing/)                                          | Reference   | Reference for visual editing/history; slide generation is a separate product.         |
| [Slides](https://www.agent-native.com/docs/template-slides/)                                                                              | Reference   | Reference for visual editing/history; slide generation is a separate product.         |
| [Agent UX Kit](https://www.agent-native.com/docs/toolkit-agent-ux/)                                                                       | Retained    | Core chat/composer, handoff, and newly visible active runs.                           |
| [Toolkit Capability Modules](https://www.agent-native.com/docs/toolkit-capability-packages/)                                              | Conditional | No additional package justified by current CYOA workflows.                            |
| [Collaboration Kit](https://www.agent-native.com/docs/toolkit-collaboration/)                                                             | Changed     | Presence/cursors/CRDT undo deferred with the client lifecycle.                        |
| [Command & Navigation Kit](https://www.agent-native.com/docs/toolkit-command-navigation/)                                                 | Retained    | Command menu and canonical deep links; global header stays removed.                   |
| [Comments & Review Kit](https://www.agent-native.com/docs/toolkit-comments-review/)                                                       | Changed     | Anchored review UI, explicit agent queue, shared ACL.                                 |
| [Context & Knowledge](https://www.agent-native.com/docs/toolkit-context-knowledge/)                                                       | Retained    | Use native context with fresh CYOA reads; no separate knowledge store.                |
| [Editors & Canvases](https://www.agent-native.com/docs/toolkit-editors-canvases/)                                                         | Retained    | CYOA-specific renderer/forms; shared primitives reused.                               |
| [History Kit](https://www.agent-native.com/docs/toolkit-history/)                                                                         | Changed     | Checkpoint UI, validated restore, shared ACL.                                         |
| [Observability Kit](https://www.agent-native.com/docs/toolkit-observability/)                                                             | Retained    | Standard operations surface retained.                                                 |
| [Org & Team Kit](https://www.agent-native.com/docs/toolkit-org-team/)                                                                     | Retained    | Team/organization settings surface retained.                                          |
| [Resource Kit](https://www.agent-native.com/docs/toolkit-resources/)                                                                      | Retained    | SQL-backed agent resources/file tooling in standard agent settings.                   |
| [Settings Kit](https://www.agent-native.com/docs/toolkit-settings/)                                                                       | Retained    | Searchable SettingsTabsPage and agent settings tabs.                                  |
| [Setup & Connections Kit](https://www.agent-native.com/docs/toolkit-setup-connections/)                                                   | Retained    | Standard secrets/provider setup surfaces; no new credentials.                         |
| [Sharing Kit](https://www.agent-native.com/docs/toolkit-sharing/)                                                                         | Retained    | Existing share controls; history/review reuse their ACL.                              |
| [Toolkit UI Primitives](https://www.agent-native.com/docs/toolkit-ui/)                                                                    | Retained    | Local UI adapter layer and ToolkitProvider.                                           |
| [Tracking & Analytics](https://www.agent-native.com/docs/tracking/)                                                                       | Conditional | App default tags retained; analytics provider/export not configured here.             |
| [Using Your Agent](https://www.agent-native.com/docs/using-your-agent/)                                                                   | Retained    | UI/action/agent shared state with improved current-selection context.                 |
| [Voice Input](https://www.agent-native.com/docs/voice-input/)                                                                             | Retained    | Native composer/voice settings; provider or browser capabilities still required.      |
| [What Is Agent-Native?](https://www.agent-native.com/docs/what-is-agent-native/)                                                          | Reference   | Conceptual model: shared app data and actions.                                        |
| [Workspace Connections](https://www.agent-native.com/docs/workspace-connections/)                                                         | Conditional | Connect-once provider grants need actual workspace services.                          |
| [Workspace Governance](https://www.agent-native.com/docs/workspace-management/)                                                           | Reference   | Git/runtime governance guidance; no PR or workspace reconfiguration.                  |
| [Writing Agent Instructions & Skills](https://www.agent-native.com/docs/writing-agent-instructions/)                                      | Changed     | Bounded reads, verification, checkpoint and feedback guidance.                        |

## Viewer picture feedback and navigation follow-up

The viewer and visual editor expose a chapter picker, previous/next navigation,
copyable target links, and a screenshot preview with an explicit Ask agent button.
Search jumps to choices/addons without selecting them. Same-page agent commands
reveal the target again even when its URL is unchanged; locked targets report
their state and link to the editor.

`navigate` accepts access-checked project/row/choice/addon targets. `view-screen`
includes bounded visible IDs, target state, viewport dimensions and selection
count; `screenshot: true` invokes `capture-viewer`. The capture bridge uses Core's
semantic navigation hook, shared tab identity, file-upload storage and native
`_agentImages` result support. It never starts a second SSE connection.

Screenshots are clipped DOM renderings of the viewer viewport. Full chat and
inspector panels are excluded. Image data is encrypted before upload; SQL keeps
only signed/encrypted receipts bound to the caller, organization, project, tab,
path and ten-minute expiry. Project access is checked again on upload and read,
and compare-and-set prevents late uploads replacing a newer request. Provider
blob retention is unchanged; receipt expiry does not delete stored blobs.

Image critique requires a vision-capable chat model. The configured text-only
DeepSeek provider remains text-only. Remote images blocked by network/CORS and
embedded video/canvas/iframe contents are reported as capture limitations.

Regression coverage includes private capture ownership, organization changes,
revoked access, forged/expired requests, image bounds, superseded requests,
canonical navigation, unusual imported IDs, and clipped nested scrollports.
Browser verification checks actual rendered images, screenshot upload and image
results, desktop/mobile navigation, search without build changes, locked targets,
and repeated navigation inside the visual editor. No live model request is needed
for these checks.

Final follow-up validation: **793 tests across 36 files pass**, typechecking passes,
and Doctor reports no findings or warnings across all nine guards. Desktop and
mobile browser checks passed; the returned viewer and visual-editor JPEGs were
inspected directly. The disposable browser project was removed after verification.


## Agent integrations follow-up — 2026-09-11

Rechecked the current official [action definitions](https://www.agent-native.com/docs/actions-defining/),
[mentions](https://www.agent-native.com/docs/agent-mentions/),
[automations](https://www.agent-native.com/docs/automations/) and
[integration directory](https://www.agent-native.com/docs/integrations/), then
verified the APIs against the installed Core 0.133.1 sources. Existing project
mentions, screenshot images, navigation, resource history/review, provider setup,
extensions and external-agent policies remain available.

Implemented:

- `search-project-content`: access-checked search of saved row/choice/addon IDs,
  titles and prose, including nonselectable content. Returns at most 50 results
  per page, 200-character titles and 320-character excerpts (plus ellipses), parent
  IDs, canonical editor/viewer links, and a native chat table. It excludes media,
  HTML attributes/scripts, and private editorial drafts/notes. Empty queries page
  through the outline. Navigation still respects the playable build's requirements.
  The action is in the initial chat tool set and authenticated external read catalog.
- Native `cyoa.project.created` and `cyoa.planning.status-changed` events become
  discoverable in Automations. Creation covers create/import/duplicate; planning
  covers actual saved draft/review/ready transitions. Payloads carry IDs and state
  metadata only. Emission happens after successful persistence; failed saves and
  unchanged status do not trigger work. No automation was created or enabled.
- Events belong to the actor, not the source project's owner. Organization ID is
  context for filtering, not a broadcast or access grant. Jobs re-read data with
  their creator's current project permissions; planning actions now explicitly
  propagate that identity and require editor access. The planning read is marked
  read-only for native tool dispatch.
- Event-triggered action lineage suppresses recursive events. The installed cron
  runner does not pass this lineage; a cron edit can emit an initial event, while
  event-triggered follow-ups are suppressed. The bus is in-process and best-effort:
  this is not a durable delivery/outbox guarantee.
- The completion guard now requires at least one successful result from an
  attempted project mutation. Failed calls, missing results and read-only results
  no longer count as proof. Its retry asks the agent to reconcile fresh state
  before repeating a possibly committed write, and plan mode does not force writes.
  This heuristic is a minimum evidence check, not proof that every requested edit
  succeeded; author instructions still require targeted verification.
- Runtime and CYOA-author instructions now explicitly cover bounded content search,
  target navigation, actual screenshot feedback, and requested automation setup.

Useful next connections, once the user chooses and configures a service:

| Connection | CYOA use | Setup needed |
| --- | --- | --- |
| Assets/Design app over workspace MCP/A2A | Art candidates and consistent visual references | A reachable app, scoped connection and image-capable provider where needed |
| Content/Brain or Notion | Search a lore bible before drafting linked passages | User-authorized content connection; keep project edits in local actions |
| GitHub | Track release/review issues and exported project revisions | Repository connection and explicit authorization for writes |
| Existing native automation tools | Review a draft when its status becomes review; inspect a new import | User-defined event job, configured model and deployed runner |

For example, an opted-in review job can listen to `cyoa.planning.status-changed`,
condition on the desired project/organization and `status` being `review`, read
`get-project-plan` for the payload's parent IDs, and produce review suggestions.
It must not publish live prose solely because a draft entered review. Discover
available trigger schemas before defining the job; external tool access remains
an explicit `mcpTools` allowlist. Remote MCP, workspace connections and provider
APIs are separate setup paths in the official directory; a listed preset is not
evidence of a working connection. No provider account was connected, external
message sent, schedule enabled or live paid model evaluation run in this follow-up.

Validation: **817 tests across 39 files passed**, `pnpm typecheck` passed, and all
nine Doctor guards passed with no findings or warnings. New regressions cover
search bounds/links/privacy, event payloads/ownership/recursion, successful-save
emission boundaries, and failed or missing mutation results.

The production Node build also completed successfully. It reported large client
chunks and missing production `BETTER_AUTH_SECRET`; Core keeps authentication
locked in that configuration. Deploy with the existing stable production secret
(or the supported hosted secret configuration). Build success is not a claim
that production authentication or remote provider execution was validated.
