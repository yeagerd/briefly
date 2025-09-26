# Email View Performance

## Overview of options

- Persist email state in `OfficeProvider` so switching tools does not refetch
- Incremental sync: use change/delta tokens to avoid re-fetching existing items
- Add pagination/infinite scroll: show first 10 immediately; background-load more
- Lazy-load message bodies: fetch on expand; render preview/snippet first
- Virtualize the email list (e.g., react-window) to render only visible rows
- Reduce re-renders: memoize row components and stabilize props/keys
- Backend HTTP caching: ETag/If-None-Match + short TTL for lists/bodies
- Batch Office API requests where supported to cut round-trips
- Optional: client persistent cache (IndexedDB) with SWR-style stale-while-revalidate
- Add basic metrics (TTFB, list render time, fetch timings) to verify improvements

### [x] MVP Checklist — Persist email state in an Office Provider

Success criteria: switching tools returns to email view instantly with no network refetch when data is cached; manual refresh still forces a refetch.
- [x] Leverage existing provider: extend `frontend/contexts/office-data-context.tsx` or add a sibling `OfficeEmailProvider` mounted at the same level to persist across tool switches.
- [x] Inventory email fetchers (list, thread, bodies) and route them through the provider rather than individual views firing on mount.
- [x] Define cache keys: lists → `userId+folderId+query+pageSize`, threads → `userId+threadId`.
- [x] Extend provider state: `listCache`, `threadCache`, loading flags, error, `lastUpdated`, pagination cursors; keep `inflightByKey` in a ref for de-duplication.
- [x] TTLs: lists 60s, threads 120s; render cached immediately; refresh in background when stale.
- [x] Eviction: LRU per scope (≈10 lists, 50 threads) to bound memory.
- [x] Invalidation rules: account/folder change resets scope; send/receive invalidates that thread; manual refresh forces refetch while keeping cached visible until new data returns.
- [x] De-dup inflight: one request per cache key; share promise to concurrent callers.
- [x] Read path: consumers read from provider; if missing/stale-without-inflight, kick off background fetch and render cached immediately when present.
- [x] Update views to use provider selectors/hooks (e.g., `useEmailList(scope)`, `useEmailThread(id)`), not ad-hoc fetches in components.
- [x] Keep lazy body loading behavior: never refetch cached bodies; fetch body on expand when absent.
- [x] Add refresh action and "Updated N seconds ago" indicator using provider timestamps.
- [ ] Metrics: cache hit ratio (list/thread), requests per navigation, time to first list paint.
- [x] Manual QA: 1) open inbox, 2) switch tools, 3) return (no list refetch), 4) click refresh (network refetch), 5) open thread, 6) switch tools/back (thread from cache), 7) send test email (thread updates).

### [x] MVP Checklist — Incremental sync with change/delta tokens

Success criteria: previously seen items do not refetch; new/updated/deleted items appear via delta without a full list reload.
- [x] Choose delta scope key: `userId+folderId(+query)`; one token per scope.
- [x] Storage: persist token server-side per user+scope; mirror latest token and `lastSuccessfulSyncAt` in provider for quick access.
- [x] Provider integration: in `office-data-context` (or sibling provider), add `deltaTokenByScope`, `deltaInflightByScope` (ref), and expose `seedScope(scope)` + `runDelta(scope)`.
- [x] Seed step: full listing until a `deltaToken`/`deltaLink` is returned; populate provider caches and persist token.
- [x] Seed paging: consume `nextLink` until `deltaLink` with a timebox; render progressively from cache.
- [x] Delta step: call delta endpoint with stored token; receive created/updated/deleted/moved and a new token; merge into provider caches; persist new token.
- [x] Merge rules: de-duplicate by `messageId`; update in place; remove deleted; on moves, remove from source scope.
- [x] Ordering: keep `receivedDateTime` desc; update pagination cursors accordingly.
- [x] Concurrency: one inflight delta per scope; share promise; drop redundant triggers while one is running.
- [x] Token invalidation: on 410/expired, re-seed scope; show a one-time non-blocking toast.
- [x] Backoff/retry: exponential backoff on transient errors; retain current token on failure.
- [x] Triggers: run delta on folder focus, interval (~60s), manual refresh; debounce rapid re-entry.
- [x] Data contract: backend returns { created[], updated[], deleted[], nextToken } with fields sufficient for list render.
- [x] Integration: write changes to `listCache`/`threadCache` in provider so UI updates instantly without re-requesting known items.
- [x] Metrics: delta duration, counts by change type, token invalidations, avoided full fetches.
- [x] Manual QA: 1) seed inbox, 2) send new mail (appears), 3) update flag (reflected), 4) delete/move (removed), 5) simulate invalid token (re-seed), 6) navigate away/back (no full refetch).

### [ ] MVP Checklist — Pagination / Infinite scroll (show 10 immediately)

Success criteria: first 10 headers render within 200ms after data arrival; background fetch appends more without blocking UI; no duplicate items.
- [ ] Decide page size (MVP: 10) and backfill size (next 2 pages) for background prefetch.
- [ ] Choose pagination cursor: server-provided `nextPageToken`/`nextLink` preferred; fallback to stable sort key + offset.
- [ ] Specify provider state shape additions: `pagesByScope`, `hasMore`, `nextCursor`, `inflightPageKeys`, and `seenIds` for de-dup.
- [ ] Read path: on mount, render cached first page immediately if present; otherwise request page 1 and render progressively as it resolves.
- [ ] Background load: after first page renders, trigger prefetch for page 2 (and optionally 3) in background; merge results when complete.
- [ ] Scroll trigger: use intersection observer or scroll threshold to fetch next page when near the end; guard with `inflight` and `hasMore`.
- [ ] De-duplication: filter incoming items by `messageId` using `seenIds` before merge.
- [ ] Merge rules: append by sort order; avoid re-sorting the entire list; maintain stable keys for row components.
- [ ] Error handling: show non-blocking toast/banner on page errors; allow retry; keep already-fetched pages displayed.
- [ ] Cancelation: if scope changes (folder/query/user), cancel inflight page requests for old scope.
- [ ] UI indicators: small spinner at end-of-list during background load; show total count or "More loading…" only when fetching.
- [ ] Metrics: time to first 10 render, time between page appends, count of page requests, duplicates prevented.
- [ ] Manual QA script: 1) open inbox with cold cache (first 10 render, spinner for more), 2) scroll to trigger next pages, 3) switch tools and back (pages persist from provider cache), 4) change folder/query (resets and fetches new first page), 5) simulate network error on page 2 (first page stays, retry works), 6) verify no duplicates when background prefetch and scroll-trigger overlap.

### [ ] MVP Checklist — Lazy-load message bodies (fetch on expand)

Success criteria: list renders instantly with subject/snippet; body network request only happens when a message is expanded; subsequent opens use cached body.
- [ ] Decide minimal list item fields: `id`, `subject`, `from`, `to`, `preview/snippet`, `receivedDateTime`, `hasAttachments`.
- [ ] Specify provider state additions: `bodyByMessageId`, `bodyInflightById`, `bodyErrorById`, `bodyLastUpdatedById`.
- [ ] Choose cache TTL for bodies (e.g., 10 minutes) and a small LRU (e.g., 100 bodies) to cap memory.
- [ ] Read path: list and thread views show preview/snippet only; do not request body on initial render.
- [ ] Expand behavior: on first expand, check `bodyByMessageId`; if missing and not inflight, start fetch; show skeleton/placeholder while loading.
- [ ] De-dup inflight: if a body is already being fetched, reuse the same promise; avoid parallel duplicate requests.
- [ ] Sanitize body HTML on fetch (strip unsafe tags/attributes); block remote images by default for MVP or lazy-load them separately.
- [ ] Attachments/inline images: render placeholders or filenames first; fetch/download on explicit user action if large.
- [ ] Error handling: if body fetch fails, show inline error with a retry action; preserve the list state.
- [ ] Cancellation: if the message is collapsed or user navigates away, allow request to complete; ignore result if scope changed.
- [ ] Keyboard navigation: ensure moving selection does not auto-fetch bodies until actually expanded/opened.
- [ ] Metrics: time to first render (list), time from expand to body paint, body cache hit ratio, number of body fetches per session.
- [ ] QA script: 1) open inbox (no body fetches), 2) expand a message (one body fetch), 3) collapse and re-expand (cached body, no new fetch), 4) expand another message (single fetch), 5) navigate away and back (bodies still cached within TTL), 6) toggle images on/off and verify safety.

### [ ] MVP Checklist — Virtualize the email list (render only visible rows)

Success criteria: smooth scroll at 60fps with 5k+ items; initial paint renders only visible rows; memory stays flat as list grows.
- [ ] Choose library (MVP): `react-window` (FixedSizeList) or `react-virtual` for simplicity.
- [ ] Decide item height strategy: fixed row height for MVP; if variable, provide estimated size and overscan.
- [ ] Integrate virtualizer in the email list view: replace map over items with virtualized list component.
- [ ] Provide stable `itemKey` based on `messageId` to prevent row remounts.
- [ ] Overscan settings: start with 2-3 screens of overscan to avoid blanking during fast scroll; tune after testing.
- [ ] Row content: keep lightweight; avoid heavy synchronous work in render; memoize row component; defer avatars/attachments.
- [ ] Maintain selection/focus/keyboard navigation: ensure virtualized rows preserve focus when recycled; store selection in provider.
- [ ] Handle empty and loading states inside the virtualized container (e.g., skeleton rows).
- [ ] Integrate with pagination/infinite scroll: when near the end of rendered items, trigger next page; do not grow DOM nodes beyond viewport.
- [ ] Integrate with lazy body loading: expanding a message should not force all rows to mount; expanded state lives outside row index.
- [ ] Accessibility: ensure list has appropriate roles/aria; preserve tab order and screen reader announcements for newly rendered rows.
- [ ] Testing: verify performance with 10k mock items; ensure no layout thrash (avoid dynamic heights) and stable fps.
- [ ] Metrics: track largest list render time, average frame time while scrolling, number of mounted row components.
- [ ] QA script: 1) load inbox with large dataset (simulate), 2) scroll quickly top→bottom (no hitching), 3) select an item and scroll offscreen/back (selection persists), 4) trigger pagination while near end (no DOM growth), 5) expand a message and scroll (expansion persists without reflow), 6) measure memory remains stable.

### [ ] MVP Checklist — Reduce re-renders (memoize rows, stabilize props/keys)

Success criteria: row re-renders occur only when the underlying message data changes or selection/hover state changes; scrolling does not re-render offscreen rows.
- [ ] Memoize row component (e.g., React.memo) with a custom props comparator focused on `messageId`, critical visual fields, and shallow equality for small objects.
- [ ] Stabilize row `key`: use `messageId` only; avoid using array index or concatenations that change across pages.
- [ ] Stabilize props: avoid passing new object/array literals each render (e.g., handlers, style objects); pre-bind callbacks and hoist stable objects.
- [ ] Extract derived display values (e.g., formatted date) with `useMemo` keyed by `messageId` and the raw value.
- [ ] Avoid context over-render: do not pass large context objects directly into rows; select minimal slices via selectors or prop drilling of primitives.
- [ ] Keep selection/hover state outside individual rows (e.g., in provider or parent) and pass stable IDs; rows compute selected boolean from stable ids.
- [ ] For virtualized lists, ensure `itemKey` and `itemData` remain referentially stable between renders to prevent row recycling churn.
- [ ] Debounce high-frequency UI updates (hover) and avoid storing hover in React state; use CSS :hover when possible.
- [ ] Ensure pagination merges do not recreate the entire `items` array unnecessarily; append in place when safe or use immutable updates with stable references for unchanged items.
- [ ] Verify that background delta updates only touch changed items; batch state updates to minimize re-renders.
- [ ] Add a development-only render counter in the row (e.g., a console count or small badge) to confirm re-render reductions during testing.
- [ ] Metrics: track average renders per row per minute during typical navigation and scroll, and total renders during pagination/delta events.
- [ ] QA script: 1) scroll through inbox (rows not changing do not re-render), 2) select/unselect messages (only affected rows update), 3) paginate (existing rows keep keys and do not re-render), 4) receive delta update (only changed rows re-render), 5) toggle a global UI element (rows remain stable).