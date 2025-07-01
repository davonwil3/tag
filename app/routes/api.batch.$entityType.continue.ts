import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { processBatch, type EntityType } from "~/jobs/batchTagPastData.server";
import { prisma } from "~/db.server";

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { entityType } = params;
  
  if (!entityType || !["order", "product", "customer"].includes(entityType)) {
    return json({ error: "Invalid entity type" }, { status: 400 });
  }

  try {
    // Get all shops that have batch processing in progress for this entity type
    const settings = await prisma.merchantSettings.findMany({
      where: {
        [`${entityType}BatchProgress`]: {
          not: null,
        },
      },
    });

    if (settings.length === 0) {
      return json({
        processed: 0,
        message: `No active ${entityType} batch processing found`,
        results: [],
      });
    }

    const results = [];

    for (const setting of settings) {
      const progressField = `${entityType}BatchProgress` as keyof typeof setting;
      const cursorField = `${entityType}BatchCursor` as keyof typeof setting;
      
      const progress = setting[progressField] as any;
      const cursor = setting[cursorField] as string | null;

      // Skip if already done
      if (progress && progress.done) {
        results.push({
          shop: setting.shop,
          success: true,
          result: { done: true, message: "Already completed" },
        });
        continue;
      }

      try {
        console.log(`Processing ${entityType} batch for shop: ${setting.shop}`);
        
        const result = await processBatch({
          shop: setting.shop,
          entityType: entityType as EntityType,
          cursor,
        });

        results.push({
          shop: setting.shop,
          success: true,
          result,
        });

        console.log(`Completed ${entityType} batch for shop: ${setting.shop}`, result);
      } catch (error) {
        console.error(`Error processing ${entityType} batch for shop ${setting.shop}:`, error);
        results.push({
          shop: setting.shop,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return json({
      processed: results.length,
      results,
      message: `Processed ${results.length} shops for ${entityType} batch`,
    });
  } catch (error) {
    console.error(`Critical error in ${entityType} batch continue:`, error);
    return json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 });
  }
};

export const loader = () => new Response("Method Not Allowed", { status: 405 }); 