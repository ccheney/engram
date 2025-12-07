import { NextResponse } from "next/server";
import type { z } from "zod";

export const validate =
  (schema: z.ZodSchema<unknown>) =>
  async (req: Request, next: (data: unknown) => Promise<NextResponse>) => {
    try {
      const body = await req.json();
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      return next(parsed.data);
    } catch (_e) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  };
