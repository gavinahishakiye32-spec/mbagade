import mongoose from "mongoose";
import { env } from "@/lib/env";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalForMongoose = globalThis as unknown as { __bbMongoose?: MongooseCache };

const cache: MongooseCache =
  globalForMongoose.__bbMongoose ?? (globalForMongoose.__bbMongoose = { conn: null, promise: null });

export async function connectDB(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;
  if (!cache.promise) {
    mongoose.set("strictQuery", true);
    cache.promise = mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 8000 });
  }
  try {
    cache.conn = await cache.promise;
  } catch (err) {
    cache.promise = null;
    throw err;
  }
  return cache.conn;
}

export function objectIdEquals(a: unknown, b: unknown): boolean {
  if (!a || !b) return false;
  const as = typeof a === "string" ? a : String(a);
  const bs = typeof b === "string" ? b : String(b);
  return as === bs;
}
