import { RawStreamEventSchema } from "@the-soul/events";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { validate } from "../../../lib/validate";

export const POST = async (req: Request) => {
  return validate(RawStreamEventSchema as unknown as z.ZodSchema<unknown>)(req, async (data) => {
    const event = RawStreamEventSchema.parse(data);
    console.log("Ingesting event:", event.event_id);
    // TODO: Push to Redpanda via Ingestion Service or direct Kafka client
    return NextResponse.json({ status: "accepted", event_id: event.event_id }, { status: 202 });
  });
};
