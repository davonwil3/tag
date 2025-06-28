import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return new Response("Method not allowed", { status: 405 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("=== CUSTOMER WEBHOOK START ===");
  
  try {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const { admin, session, payload } = await authenticate.webhook(request);
    
    if (!session?.shop) {
      return json({ error: "Invalid session or missing shop" }, { status: 401 });
    }

    const shop = session.shop;
    const customer = payload as any;
    console.log("Customer payload:", { id: customer?.id, email: customer?.email });

    if (!customer?.id) {
      return json({ error: "Invalid customer payload" }, { status: 400 });
    }

    // Get all rules for this shop
    const rules = await prisma.rule.findMany({
      where: { shop },
    });

    // Get current customer tags
    const currentTags = customer.tags ? customer.tags.split(",").map((tag: string) => tag.trim()) : [];

    // Check each rule
    for (const rule of rules) {
      if (rule.appliesTo !== "Customer") continue;

      let shouldApplyTag = false;

      switch (rule.condition) {
        case "total_spent":
          shouldApplyTag = parseFloat(customer.total_spent || "0") > parseFloat(rule.conditionValue);
          break;
        case "orders_placed":
          shouldApplyTag = parseInt(customer.orders_count || "0") > parseInt(rule.conditionValue);
          break;
        case "has_email":
          shouldApplyTag = rule.conditionValue === "Yes" ? !!customer.email : !customer.email;
          break;
        case "customer_tagged":
          const customerTags = customer.tags ? customer.tags.split(",").map((tag: string) => tag.trim()) : [];
          shouldApplyTag = customerTags.includes(rule.conditionValue);
          break;
        case "accepts_marketing":
          shouldApplyTag = rule.conditionValue === "Yes" ? customer.accepts_marketing : !customer.accepts_marketing;
          break;
        case "customer_location":
          shouldApplyTag = customer.default_address?.country_code === rule.conditionValue;
          break;
        case "created_before":
          const createdDate = new Date(customer.created_at);
          const beforeDate = new Date(rule.conditionValue);
          shouldApplyTag = createdDate < beforeDate;
          break;
      }

      console.log("Customer rule check:", { 
        rule: rule.name, 
        condition: rule.condition, 
        shouldApply: shouldApplyTag 
      });

      if (shouldApplyTag && !currentTags.includes(rule.tag)) {
        try {
          // Add the new tag
          currentTags.push(rule.tag);

          // Update the customer with new tags
          const result = await admin.graphql(`
            mutation customerUpdate($input: CustomerInput!) {
              customerUpdate(input: $input) {
                customer {
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
                id: customer.admin_graphql_api_id,
                tags: currentTags.join(", ")
              }
            }
          });
          
          console.log("Customer GraphQL result:", JSON.stringify(result, null, 2));
          console.log(`Successfully applied tag ${rule.tag} to customer ${customer.id}`);
          
          // Track tag activity
          try {
            await prisma.tagActivity.create({
              data: {
                shop,
                entityType: "Customer",
                entityId: customer.id.toString(),
                tag: rule.tag,
                ruleId: rule.id,
              },
            });
            
            // Update tag usage statistics
            await prisma.tagUsage.upsert({
              where: {
                shop_tag: {
                  shop,
                  tag: rule.tag,
                },
              },
              update: {
                count: {
                  increment: 1,
                },
                lastUsed: new Date(),
              },
              create: {
                shop,
                tag: rule.tag,
                count: 1,
              },
            });
          } catch (dbError) {
            console.error("Error tracking tag activity:", dbError);
          }
        } catch (error) {
          console.error(`Error updating customer ${customer.id}:`, error);
          return json({ 
            error: "Failed to update customer tags",
            details: error instanceof Error ? error.message : "Unknown error"
          }, { status: 500 });
        }
      }
    }

    console.log("Customer webhook handler completed successfully");
    return json({ success: true });
  } catch (error) {
    console.error("=== CUSTOMER WEBHOOK ERROR ===");
    console.error("Customer webhook handler error:", error);
    return json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}; 