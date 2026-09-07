# roadmap

## asherin.data — data intelligence platform rebuild (complete)
- [x] schema: workspaces/roles, sources, versions, records, dictionary, chunks, queries, alerts, dashboards, reports, webhooks, audit, lineage, storage bucket
- [x] client libs: parsers (csv/xlsx/json/parquet/pdf/image/sql), validation + quality score, profiling, join suggester, chart selection engine, theme tokens + wcag check
- [x] edge functions: ingest, ask, alerts-run, report, sync (connectors), api + webhooks
- [x] ui: sources, dataset detail, ask, visuals, alerts, reports, settings/api
- [x] route asherin.data to the new room, legacy azplen panels no longer mounted
- [x] tests + live verification (world bank gdp csv: ingest 320 rows, grounded ask with evidence + chart + confidence, alerts, report)


## incoming
- [ ] next user message: convert into a deep step-by-step build plan (human logic + reasoning patterns, filled-in context) and build it without asking questions
