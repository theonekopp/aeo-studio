Here is a **tight, developer-ready PRD** for the *AEO Counterfactual Impact Lab* — designed so you can hand it directly to an engineering team to build the beta.

I’ve kept it concise, structured, and actionable, and focused on the **MVP / beta scope**.

---

# **PRODUCT REQUIREMENTS DOCUMENT (PRD)**

## **AEO Counterfactual Impact Lab — Beta Version**

### **Version:** 0.9

### **Owner:** Matt Koppenheffer

### **Engineering:** Backend, Frontend, ML/LLM

### **Target Delivery:** 4–6 weeks (beta)

---

# **1. Overview**

The AEO Counterfactual Impact Lab is a tool for tracking and improving Answer Engine Optimization (AEO) performance across search engines (Google, LLM-based answer surfaces, etc.).
Unlike traditional SEO tracking tools, this system:

1. **Observes real answer-engine outputs** for a set of queries.
2. **Evaluates inclusion and quality of brand representation.**
3. **Runs constrained counterfactual simulations** to identify *only the levers SEO/AEO practitioners can pull*.
4. **Ranks these levers by predicted impact** on brand inclusion in answer surfaces.

The beta will provide basic automation, LLM evaluation, a minimal UI, and actionable output.

---

# **2. Goals & Success Criteria**

### **2.1 Primary Goals**

* Automate capturing answer-engine responses for selected queries.
* Use LLM evaluators to score:

  * Brand presence
  * Prominence
  * Persuasiveness
* Run **AEO-only counterfactual simulations** to identify:

  * Which SEO/AEO levers would increase inclusion
  * How much impact each lever would have
* Provide an interactive dashboard to:

  * Track scores over time
  * Surface high-impact opportunities
  * Visualize counterfactual deltas

### **2.2 Success Criteria**

* System reliably captures snapshots for all query × engine pairs in each run.
* Evaluator output is structured JSON with <10% failure rate.
* Counterfactual runs return ranked, practitioner-actionable levers.
* Dashboard displays trends and opportunity ranking.
* Beta user (Matt) can:

  * Identify top 10 AEO opportunity queries
  * See which levers improve likelihood of inclusion
  * Generate recommendations for content roadmap

---

# **3. Scope — Beta (MVP) Only**

### **Included**

* Query management
* Engine configuration
* Automated snapshot collection (LLM APIs only)
* LLM evaluation (baseline + constrained counterfactuals)
* Postgres persistence (Railway)
* Web dashboard (Next.js)
* Basic auth
* JSON API for all data

### **Excluded (for now)**

* Multi-tenant / client accounts
* Worker queues (simple cron-based execution is fine)
* Screenshot storage
* Full replayable browser-based crawling
* On-page content ingestion or analysis
* User roles and permissions
* Full CI/CD pipeline

---

# **4. Feature Requirements**

## **4.1 Query Master**

A UI table to manage trackable queries.

**Fields:**

* `id`
* `text`
* `slug`
* `funnel_stage` (enum: TOFU/MOFU/BOFU)
* `priority` (1–3)
* `target_url` (optional)

**User actions:**

* Add/edit/delete query
* Bulk import via CSV

---

## **4.2 Engine Configuration**

Support for initially **three** engine types:

### 1. ChatGPT Answer

* Mode: `direct_answer`
* Prompt: system prompt instructing to answer as a user-facing assistant

### 2. Perplexity (simple API query)

**Fields:**

* `name` (chatgpt/perplexity)
* `surface` (direct_answer)
* `region` (us)
* `device` (desktop)

UI not required in beta — engines can be seeded in DB.

---

## **4.3 Observations (Snapshots)**

Each run captures one observation per:

> **query × engine**

**Saved fields:**

* `id`
* `run_id`
* `query_id`
* `engine_id`
* `captured_at`
* `raw_answer` (JSON string; must store entire SERP API or LLM result blob)
* Optional: `parsed_answer` (text extraction)

**Requirements:**

* Worker must handle failures and log them
* Raw answer must be 1:1 reproducible

---

## **4.4 LLM Evaluation — Baseline Scoring**

Each observation is scored by an evaluator LLM.

**Input:**

* query
* brand names (configurable)
* parsed answer text

**Output JSON:**

```
{
  "presence_score": 0 | 1 | 2 | 3,
  "prominence_score": 0 | 1 | 2 | 3,
  "persuasion_score": 0 | 1 | 2 | 3,
  "summary": "one-sentence explanation",
  "detected_brand_urls": ["..."],
  "detected_competitors": ["..."]
}
```

**Scoring must be:**

* deterministic (via structured prompt)
* validated by schema (throw if incomplete)

---

## **4.5 Constrained Counterfactual Engine**

For each observation, run a second evaluator prompt that tests **only SEO/AEO-movable levers**.

**Allowed levers:**

1. Content coverage (new/missing depth)
2. Entity clarity (insurance, locations, synonyms)
3. Evidence/authority signals
4. Geo specificity (within existing footprint)
5. Comparison/decision support additions
6. UX/answerability structure

**Counterfactual output JSON:**

```
{
  "lever": "Entity clarity",
  "description": "Clarify insurance acceptance via structured Q&A",
  "inclusion_after": true,
  "reason": "Removes ambiguity in engine's understanding",
  "effort_score": 1 | 2 | 3 | 4 | 5,
  "impact_score": 1 | 2 | 3 | 4 | 5,
  "confidence": 0.0 - 1.0
}
```

Beta requirement:
**At least 3 counterfactuals per query × engine.**

Store in `counterfactuals` table.

---

## **4.6 Scoring & Delta Calculations**

System should compute:

* `total_score` = presence + prominence + persuasion
* `inclusion_delta` = inclusion_after - inclusion_before
* `impactability` = impact_score / effort_score

These power the dashboard.

---

## **4.7 Dashboard (Next.js)**

### **Views:**

#### **1. Run Summary**

* Heatmap table: `query × engine` with total_score
* Toggle: show deltas vs previous run

#### **2. Query Detail**

* Line chart: score over time (per engine)
* Table: baseline evaluator output
* Table: counterfactual outputs

#### **3. Opportunities View**

Sort queries by:

1. High priority (priority = 1)
2. Low total score (≤3)
3. High “impactability”
4. High-confidence counterfactuals

Displayed as:

```
[Query] — [Engine]
Top Impactable Lever: Entity clarity
Projected inclusion: 0 → 1
Effort: Low (1)
Impact: High (5)
```

### **Authentication**

* Minimal password login
* No RBAC

---

# **5. System Architecture**

### **5.1 Components**

* **Backend API:** Node/Express or FastAPI
* **Workers:**

  * snapshot-capture worker
  * scoring worker
  * counterfactual worker
* **Database:** Postgres (Railway)
* **Frontend:** Next.js
* **Hosting:** Railway (all services)

### **5.2 API Endpoints (Minimum)**

```
POST /runs/start
GET  /runs/:id
GET  /runs/:id/summary
GET  /queries
POST /queries
GET  /queries/:id
GET  /observations?run_id=...
GET  /counterfactuals?observation_id=...
POST /jobs/capture-run
POST /jobs/score-run
POST /jobs/counterfactual-run
```

---

# **6. Data Model (DB Schema)**

### **queries**

```
id, text, slug, funnel_stage, priority, target_url
```

### **engines**

```
id, name, surface, region, device
```

### **runs**

```
id, label, started_at
```

### **observations**

```
id, run_id, query_id, engine_id,
raw_answer, parsed_answer, captured_at
```

### **scores**

```
id, observation_id,
presence_score, prominence_score, persuasion_score, total_score,
summary, detected_brand_urls, detected_competitors
```

### **counterfactuals**

```
id, observation_id,
lever, description, inclusion_after,
reason, effort_score, impact_score, confidence
```

---

# **7. Constraints & Assumptions**

* LLM calls must be rate-limited and retries-enabled
* LLM API cost must be monitored (beta capped at <1000 queries/month)
* Counterfactual runs capped at **3/observation** for beta
* All results must be immutable (no overwriting snapshots)

---

# **8. Risks & Mitigations**

| Risk                             | Mitigation                                |
| -------------------------------- | ----------------------------------------- |
| LLM hallucination in evaluations | Strict schema validation + retries        |
| LLM inconsistencies              | Strict prompts; retries; cache raw answers |
| Costs spiraling                  | Throttled runs; monthly cap settings      |
| Too much output clutter          | Limit counterfactuals to 3 curated levers |
| Levers not actually actionable   | Constrained lever set + validation        |

---

# **9. Non-Goals**

* Full competitive intelligence
* Full content auditing
* On-site crawling
* Automated content generation
* Edge-based distributed system
* Real-time engines (daily runs)

This is a **weekly AEO intelligence tool**, not a crawler or content generator.

---

# **10. Future Enhancements (Post-Beta)**

* Multi-tenant mode for client onboarding
* Advanced entity graph modeling
* Automatic “Content Brief” generation from counterfactuals
* Screenshot capture + annotation
* Multi-model evaluator ensemble
* API for third-party analytics tools
* Heatmap of “content leverage” across intent clusters

---
