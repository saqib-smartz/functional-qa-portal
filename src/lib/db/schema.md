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
}
```

Run once against the provisioned Atlas cluster (see `MONGODB_URI` in `.env.example`), via `mongosh` or the Atlas UI's Indexes tab:

```js
db.audits.createIndex({ url: 1, crawledAt: -1 }, { name: "audits_url_crawledAt_idx" });
db.audits.createIndex({ crawlBatchId: 1 }, { name: "audits_crawlBatchId_idx", sparse: true });
```
