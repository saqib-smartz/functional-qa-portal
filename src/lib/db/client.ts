import { MongoClient, type Db } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;

// Cache the connect() promise (not just the client) across warm serverless invocations, and
// across HMR reloads in dev via a global, so concurrent cold-start callers share one in-flight
// connection instead of racing to open their own.
let clientPromise: Promise<MongoClient> | null = null;

function getClientPromise(): Promise<MongoClient> {
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set.");
  }
  if (process.env.NODE_ENV === "development") {
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };
    if (!globalWithMongo._mongoClientPromise) {
      globalWithMongo._mongoClientPromise = new MongoClient(MONGODB_URI).connect();
    }
    return globalWithMongo._mongoClientPromise;
  }
  if (!clientPromise) {
    clientPromise = new MongoClient(MONGODB_URI).connect();
  }
  return clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClientPromise();
  return client.db();
}

export function isDbConfigured(): boolean {
  return Boolean(MONGODB_URI);
}
