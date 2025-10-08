## Priority Inbox MVP: Unified is_priority across Google and Microsoft

### Scope
- Establish a provider-agnostic `is_priority` for emails
- Map Gmail non-Promotions and Outlook Focused to `is_priority`
- Surface `is_priority` to frontend and Vespa for filtering/demo
- Adopt Gmail-style categories across providers; map Outlook Focused→`CATEGORY_PERSONAL`, Other→`CATEGORY_OTHER`

### Backend (Office Service)
- [x] Add `is_priority: bool = False` to `EmailMessage` API schema (`services/api/v1/office/schemas.py`)
- [x] Gmail normalization: set `is_priority` when Gmail labelIds do NOT include `CATEGORY_PROMOTIONS` (`services/office/core/normalizer.py`)
- [x] Microsoft normalization: set `is_priority` when `inferenceClassification == focused` (ignore `importance`) (`services/office/core/normalizer.py`)
- [x] Include `is_priority` in `/messages` and `/threads` responses (`services/office/api/email.py`)
- [x] Optional: support `priority=true|false` query param to filter server-side
  - Gmail: apply `q=-category:promotions` when `priority=true`
  - Outlook: apply `$filter=(inferenceClassification eq 'focused')` when `priority=true`
- [x] Update internal threads/messages aggregations and cache keys to include `priority` filter param where applicable (`services/office/api/email.py`)
- [x] Regenerate OpenAPI schema and clients so `is_priority` and category fields are exposed (`scripts/generate-api-schema.sh` + frontend type regen)
- [x] **API Schema Cleanup**: Remove redundant `inference_classification` from API schema, keep only `derived_category` for cleaner interface

### Provider-derived Categories (Microsoft → Gmail buckets)
- [x] Add `derived_category: Optional[str]` to `EmailMessage` (values: `CATEGORY_PERSONAL`, `CATEGORY_OTHER`) (`services/api/v1/office/schemas.py`)
- [x] Microsoft normalization: set `derived_category = CATEGORY_PERSONAL` when `inferenceClassification == focused`, else `CATEGORY_OTHER` (`services/office/core/normalizer.py`)
- [x] Gmail: continue passing native Gmail `CATEGORY_*` via `labels`; do not set `CATEGORY_OTHER` for Gmail
- [x] Include `derived_category` in `/messages` and `/threads` responses (`services/office/api/email.py`)
  - Note: If Gmail categories are disabled on an account, `CATEGORY_*` labels may be absent; do not infer for Gmail in MVP

### Events & Ingestion
- [x] Add `is_priority: bool` to `EmailData` (`services/common/events/email_events.py`)
- [x] Populate `is_priority` in backfill to events (`services/office/api/backfill.py`)
- [x] Ensure cache/serialization paths carry `is_priority` consistently
- [x] Add `derived_category: Optional[str]` to `EmailData` and populate for Microsoft; pass-through Gmail categories in `labels`
- [x] Ensure Pub/Sub EmailEvent payloads include the new fields and version metadata (`services/common/events/email_events.py`)

### Vespa
- [x] Add `is_priority` (bool) to schema(s): `vespa/schemas/briefly_document.sd` (and `email_document.sd` if used)
- [x] Add `is_priority` to `VespaDocumentType` and `to_dict` (`services/api/v1/vespa_query/vespa_types.py`)
- [x] Set `is_priority` in `VespaDocumentFactory.create_email_document` (`services/vespa_loader/document_factory.py`)
- [ ] Deploy schema update and reload app locally
- [ ] Optional: add slight rank boost for priority emails in email rank profiles
- [x] Add `derived_category` (string) to schema(s) and `VespaDocumentType`; set in `VespaDocumentFactory.create_email_document`
- [ ] Update Vespa query layer to support filtering by `is_priority` and/or `derived_category` (`services/vespa_query/query_builder.py`)

### Frontend (MVP UI)
- [x] Regenerate API types/clients to include `is_priority` and `derived_category` (or extend local types temporarily)
- [ ] Add Priority toggle/filter in email view that filters on `is_priority`
- [ ] Display a subtle "Priority" badge on list items when `is_priority`
- [ ] If backend `priority` param is implemented, wire toggle to server-side filtering
- [ ] Optional: expose a Category facet — show Gmail native categories and Microsoft `derived_category`
  - Indicate derived categories subtly for Microsoft (tooltip or badge)

### Tests
- [x] Unit tests: normalizers set `is_priority` for Google/Microsoft cases
- [x] API tests: `/messages` returns `is_priority`; server-side filter (if added)
- [x] Ingestion tests: `EmailData` carries `is_priority` → Vespa document includes it
- [ ] Frontend smoke test: priority toggle narrows results client-side
- [x] Unit tests: Microsoft `derived_category` mapping (Focused→`CATEGORY_PERSONAL`, Other→`CATEGORY_OTHER`)
- [ ] Vespa query tests: filters on `is_priority` and `derived_category`

### Demo Readiness
- [ ] Seed sample Gmail (promotions vs non-promotions) and Outlook (focused vs other) emails
- [ ] Run backfill to populate Vespa with `is_priority`
- [ ] Verify Vespa queries return `is_priority` in results
- [ ] Validate end-to-end in UI: toggle shows only priority emails
- [ ] Create short demo script and screenshots
  - Include a demo of category facet showing Gmail categories and Microsoft derived categories

### Ops & DevX
- [ ] Update docs: briefly explain `is_priority` mapping and filter param
- [ ] Add feature flag or config toggle if needed for rollout
- [x] Ensure `pytest`, `mypy services/`, linters, and `tox` pass
- [ ] Document Outlook→Gmail category mapping and limitations (axis mismatch)
- [ ] Add telemetry/metrics on proportion of priority vs non-priority and derived category distribution

### Rollback/Edge Considerations
- [ ] If schema change is delayed, gate Vespa writes of `is_priority`
- [ ] Ensure spam (`spam` label) remains independent of `is_priority`
- [ ] If derived categories cause confusion, allow UI to hide category facet for Microsoft accounts

