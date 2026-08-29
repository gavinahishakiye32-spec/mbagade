import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError } from "@/lib/auth";
import mongoose from "mongoose";

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 400,
    public details?: unknown
  ) {
    super(message);
  }
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({ success: true, data }, init);
}

export function fail(code: string, message: string, status = 400, details?: unknown): NextResponse {
  return NextResponse.json({ success: false, error: { code, message, details } satisfies ApiErrorShape }, { status });
}

/** Wraps a route handler with consistent error mapping. Never leaks internals. */
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<NextResponse>
): (...args: Args) => Promise<NextResponse> {
  return async (...args: Args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) return fail(err.code, err.message, err.status, err.details);
      if (err instanceof AuthError) {
        const status = err.code === "UNAUTHENTICATED" ? 401 : err.code === "FORBIDDEN" ? 403 : 403;
        return fail(err.code, err.message, status);
      }
      if (err instanceof ZodError) {
        return fail("INVALID_INPUT", "Invalid input", 422, err.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
      }
      if (err instanceof mongoose.Error.ValidationError) {
        return fail("INVALID_INPUT", "Invalid input", 422);
      }
      console.error("[api]", err);
      return fail("INTERNAL_ERROR", "Something went wrong. Please try again.", 500);
    }
  };
}

export async function parseJson<T>(req: Request, schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false; error: ZodError } }): Promise<T> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError("INVALID_JSON", "Request body must be valid JSON", 400);
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(
      "INVALID_INPUT",
      "Invalid input",
      422,
      result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }))
    );
  }
  return result.data;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function cursorPaginate<T extends { _id: mongoose.Types.ObjectId | string }>(items: T[], limit: number): CursorPage<T> {
  const hasMore = items.length > limit;
  const page = hasMore ? items.slice(0, limit) : items;
  return {
    items: page,
    nextCursor: hasMore && page.length > 0 ? String(page[page.length - 1]._id) : null,
  };
}
