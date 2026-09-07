# roadmap

## asherin.data — data intelligence platform rebuild (in progress)
- [ ] schema: workspaces/roles, sources, versions, records, dictionary, chunks, queries, alerts, dashboards, reports, webhooks, audit, lineage, storage bucket
- [ ] client libs: parsers (csv/xlsx/json/pdf/image/sql), validation + quality score, profiling, join suggester, chart selection engine, theme tokens + wcag check
- [ ] edge functions: ingest (validate, dictionary, chunk, embed), ask (retrieve, pattern routing, structured answer), alerts-run, report, sync (connectors), api + webhooks
- [ ] ui: sources, dataset detail (quality/dictionary/versions/lineage/table/join), ask, dashboards, alerts, reports, theme, access/audit, api/embed
- [ ] route asherin.data to the new room, retire unused azplen panels
- [ ] tests + live verification (upload, ask, alert, report, theme, embed)
