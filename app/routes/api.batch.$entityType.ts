import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { processBatch, type EntityType } from "../../jobs/batchTagPastData.server";
import { prisma } from "~/db.server";

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { entityType } = params;
  
  if (!entityType || !["order", "product", "customer"].includes(entityType)) {
    return json({ error: "Invalid entity type" }, { status: 400 });
  }

  // Get current settings
  const settings = await prisma.merchantSettings.findUnique({
    where: { shop: session.shop }
  });

  if (!settings) {
    return json({ error: "Merchant settings not found" }, { status: 404 });
  }

  // Check if already processing
  const progressField = `${entityType}BatchProgress` as keyof typeof settings;
  const currentProgress = settings[progressField] as any;
  
  if (currentProgress && !currentProgress.done) {
    return json({ error: "Batch processing already in progress" }, { status: 409 });
  }

  // Start batch processing
  const result = await processBatch({
    shop: session.shop,
    entityType: entityType as EntityType,
  });

  return json({ 
    started: true, 
    result,
    message: `Started processing ${entityType}s` 
  });
};

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const { entityType } = params;
  
  if (!entityType || !["order", "product", "customer"].includes(entityType)) {
    return json({ error: "Invalid entity type" }, { status: 400 });
  }

  // Get current progress
  const settings = await prisma.merchantSettings.findUnique({
    where: { shop: session.shop }
  });

  if (!settings) {
    return json({ error: "Merchant settings not found" }, { status: 404 });
  }

  const progressField = `${entityType}BatchProgress` as keyof typeof settings;
  const cursorField = `${entityType}BatchCursor` as keyof typeof settings;
  
  const progress = settings[progressField] as any;
  const cursor = settings[cursorField] as string | null;

  return json({
    processing: progress && !progress.done,
    progress: progress || null,
    cursor,
    entityType,
  });
}; 