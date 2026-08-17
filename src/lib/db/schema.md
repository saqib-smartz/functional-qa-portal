# `audits` collection (MongoDB Atlas)

Document shape (see `AuditDocument` in `audits.ts`):

```ts
{
  _id: string;          // report.id (UUID string), reused as the Mongo _id
  url: string;
  crawledAt: Date;
  pageTitle: string | null;
  httpStatus: number | null;
  pageText: string;
  report: AuditReport;  // native subdocument, screenshots stripped
  crawlBatchId: string | null;
  shareToken: string | null;  // public share secret; null when never shared or revoked
  sharedAt: Date | null;
}
```

`shareToken`/`sharedAt` are absent on rows written before sharing existed. No backfill is needed — `$ifNull`
and `row.shareToken ?? null` treat missing and null identically.

Run once against the provisioned Atlas cluster (see `MONGODB_URI` in `.env.example`), via `mongosh` or the Atlas UI's Indexes tab:

```js
db.audits.createIndex({ url: 1, crawledAt: -1 }, { name: "audits_url_crawledAt_idx" });
db.audits.createIndex({ crawlBatchId: 1 }, { name: "audits_crawlBatchId_idx", sparse: true });

// Partial, not sparse: revoked rows store an explicit null, which a sparse index still indexes — every
// revoked row would then collide on the unique constraint. $type: "string" excludes them cleanly.
db.audits.createIndex(
  { shareToken: 1 },
  {
    name: "audits_shareToken_idx",
    unique: true,
    partialFilterExpression: { shareToken: { $type: "string" } },
  },
);
```
