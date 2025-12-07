import type { NextResponse } from "next/server";
import type { z } from "zod";
import { apiError } from "./api-response";

export const validate =
	(schema: z.ZodSchema<unknown>) =>
	async (req: Request, next: (data: unknown) => Promise<NextResponse>) => {
		try {
			const body = await req.json();
			const parsed = schema.safeParse(body);
			if (!parsed.success) {
				return apiError("Validation Failed", "VALIDATION_ERROR", 400, parsed.error.format());
			}
			return next(parsed.data);
		} catch (_e) {
			return apiError("Invalid JSON Body", "INVALID_JSON", 400);
		}
	};
