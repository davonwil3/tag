import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return new Response("Method not allowed", { status: 405 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("Webhook request received:", request.url);
  
  try {
    if (request.method !== "POST") {
      console.log("Invalid method:", request.method);
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    console.log("Authenticating webhook...");
    const { session, payload } = await authenticate.webhook(request);
    console.log("Webhook authenticated, session:", { shop: session?.shop });
    
    if (!session?.shop) {
      console.log("No session or shop found");
      return json({ error: "Invalid session or missing shop" }, { status: 401 });
    }

    const shop = session.shop;
    const order = payload as any;
    console.log("Order payload:", { id: order?.id, total_price: order?.total_price });

    if (!order?.id) {
      console.log("Invalid order payload:", order);
      return json({ error: "Invalid order payload" }, { status: 400 });
    }

    // Get all rules for this shop
    console.log("Fetching rules for shop:", shop);
    const rules = await prisma.rule.findMany({
      where: { shop },
    });
    console.log("Found rules:", rules.length);

    // Get current order tags
    const currentTags = order.tags ? order.tags.split(",").map((tag: string) => tag.trim()) : [];
    console.log("Current tags:", currentTags);

    // Check each rule
    for (const rule of rules) {
      if (rule.appliesTo !== "Order") continue;

      let shouldApplyTag = false;

      switch (rule.condition) {
        case "total_greater_than":
          shouldApplyTag = parseFloat(order.total_price) > parseFloat(rule.conditionValue);
          break;
        case "discount_used":
          shouldApplyTag = order.discount_codes && order.discount_codes.length > 0;
          break;
        case "contains_item":
          shouldApplyTag = order.line_items?.some((item: any) =>
            item.title.toLowerCase().includes(rule.conditionValue.toLowerCase())
          );
          break;
      }

      console.log("Rule check:", { 
        rule: rule.name, 
        condition: rule.condition, 
        shouldApply: shouldApplyTag 
      });

      if (shouldApplyTag && !currentTags.includes(rule.tag)) {
        try {
          // Add the new tag
          currentTags.push(rule.tag);

          // Get admin client and update the order with new tags
          console.log("Getting admin client...");
          const { admin } = await authenticate.admin(request);
          console.log("Updating order tags...");
          await admin.graphql(`
            mutation orderUpdate($input: OrderInput!) {
              orderUpdate(input: $input) {
                order {
                  id
                  tags
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `, {
            variables: {
              input: {
                id: `gid://shopify/Order/${order.id}`,
                tags: currentTags.join(", ")
              }
            }
          });
          console.log(`Successfully applied tag ${rule.tag} to order ${order.id}`);
        } catch (error) {
          console.error(`Error updating order ${order.id}:`, error);
          return json({ 
            error: "Failed to update order tags",
            details: error instanceof Error ? error.message : "Unknown error"
          }, { status: 500 });
        }
      }
    }

    console.log("Webhook handler completed successfully");
    return json({ success: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}; 