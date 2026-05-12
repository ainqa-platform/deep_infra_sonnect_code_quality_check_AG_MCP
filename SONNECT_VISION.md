# 🌟 Sonnect: The Autonomous AI Code Sentinel

## 👁️ Vision Statement
To empower engineering teams with a **language-agnostic, autonomous code quality sentinel** that seamlessly integrates into the dev-ops lifecycle. Sonnect transforms passive code analysis into active engineering intelligence—providing real-time auditing, automated remediation, and centralized visibility into technical debt and security posture across the entire organization.

---

## 🎯 Project Goals
1.  **Language Agnostic**: Support every language in the AINQA stack (Java, Python, JS/TS, Go, etc.) without complex per-language configuration.
2.  **Jenkins-First CI/CD**: Act as a "Quality Gate" that can break builds based on AI-detected critical risks.
3.  **Self-Hosted Portal**: A private, secure team dashboard for audit history, trends, and collaborative refactoring.
4.  **Autonomous Agentic Action**: Moving from *reporting* issues to *suggesting and applying* verified code patches.

---

## 🗺️ Detailed Plan of Action

### Phase 1: CLI Evolution ("The Sentinel")
*Target: Convert the current `diq` tool into a CI-ready binary.*
- [ ] **Exit Code Logic**: Implement `--fail-on <severity>` to allow Jenkins builds to fail if 🔴 Critical issues are found.
- [ ] **Standardized Reporting**: Add `--format junit` and `--format sarif` for native visualization in Jenkins and GitHub/GitLab.
- [ ] **Config Decoupling**: Ensure 100% configuration via Environment Variables for headless CI runners.
- [ ] **Incremental Performance**: Optimize file discovery and API batching for large-scale repositories.

### Phase 2: Central Portal Infrastructure ("The Brain")
*Target: Establish the self-hosted data and UI layer.*
- [ ] **Scaffold Portal**: Build a **Next.js 15** + **Tailwind CSS** application.
- [ ] **Data Layer**: Implement **PostgreSQL** with **Prisma** to store:
    - Repository metadata.
    - Historical Audit results.
    - Severity trends over time.
- [ ] **Ingestion API**: Create a secure REST endpoint for the `diq` CLI to "push" reports after a build.
- [ ] **Security**: Integrate **Keycloak** or **OIDC** for team authentication.

### Phase 3: CI/CD & Team Integration ("The Ecosystem")
*Target: Deep integration into the AINQA development workflow.*
- [ ] **Jenkins Pipeline Library**: Create a reusable Jenkins shared library for easy `Sonnect` integration across all pipelines.
- [ ] **Webhooks**: Enable the Portal to listen for Git events and trigger "On-Demand" audits.
- [ ] **PR Bot**: Automated comments on Pull Requests showing the AI-detected impact of the changes.
- [ ] **Notification Engine**: Alerts for Slack/Teams when a build fails due to a "Sonnect Quality Gate" violation.

### Phase 4: Autonomous Agentic Remediation ("The Fixer")
*Target: Move from detection to resolution.*
- [ ] **Agentic Patching**: Allow the user to click "Apply Fix" in the Portal to generate a Git Patch.
- [ ] **Verification Loop**: Integration with local test runners to verify that an AI-applied fix doesn't break existing tests.
- [ ] **Refactor Mode**: High-level agentic task: "Refactor this Java service to use the Factory pattern," across multiple files.

---

## 🏗️ Technical Stack
- **Languages**: Node.js (TypeScript), Rust (for potential core CLI speed).
- **Frontend**: Next.js 15, Shadcn/UI, Recharts (for quality trends).
- **Backend**: Fastify or Next.js API Routes.
- **Queueing**: BullMQ + Redis (for handling high-volume audits).
- **Intelligence**: DeepInfra (Llama 3.1 70B/405B) & Local LLMs (Ollama).

---

## 📅 Execution Roadmap
- **Week 1-2**: Finalize CI-ready CLI (JUnit/Fail-on).
- **Week 3-4**: Deploy MVP Portal with basic report browsing.
- **Week 5-6**: Jenkins full integration & Automated PR reviews.
- **Week 7+**: Begin Phase 4 (Autonomous Fixes).

---

> [!IMPORTANT]
> **Privacy First**: As a self-hosted solution, Sonnect ensures that code content is only sent to the authorized LLM provider (DeepInfra) and stored strictly within the internal AINQA network.
