-- Frontline — cover the resource_sources → resources foreign key.
--
-- resource_sources.resource_id had no index, so provenance lookups and the
-- cascade-style deletes ingestion performs (removing a resource + its lineage)
-- scanned the whole table. Small now, but the food ingest pushed this table
-- past 130k rows. Clears the last performance advisor.

create index if not exists resource_sources_resource_id_idx
  on public.resource_sources (resource_id);
