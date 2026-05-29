import { NextRequest } from "next/server";
import { SyncValidateRequest, validateSchema, getErrorHint } from "@/lib/connector-validation";

export async function POST(req: NextRequest) {
  let body: SyncValidateRequest;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.connectorType || !body.connectorConfig) {
    return Response.json(
      { error: "Missing required fields: connectorType, connectorConfig" },
      { status: 400 },
    );
  }

  try {
    const result = validateSchema(body);

    if (!result.valid) {
      return Response.json(
        {
          valid: false,
          errors: result.errors.map(e => ({
            ...e,
            hint: getErrorHint(e.code).action,
          })),
        },
        { status: 422 },
      );
    }

    return Response.json({ valid: true, errors: [] });
  } catch (error) {
    console.error("Sync validation error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
