import { json } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  return new Response("Method not allowed", { status: 405 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  console.log("=== PRODUCT WEBHOOK START ===");
  
  try {
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const { admin, session, payload } = await authenticate.webhook(request);
    
    if (!session?.shop) {
      return json({ error: "Invalid session or missing shop" }, { status: 401 });
    }

    const shop = session.shop;
    const product = payload as any;
    console.log("Product payload:", { id: product?.id, title: product?.title });

    if (!product?.id) {
      return json({ error: "Invalid product payload" }, { status: 400 });
    }

    // Get all rules for this shop
    const rules = await prisma.rule.findMany({
      where: { shop },
    });

    // Get current product tags
    const currentTags = product.tags ? product.tags.split(",").map((tag: string) => tag.trim()) : [];

    // Check each rule
    for (const rule of rules) {
      if (rule.appliesTo !== "Product") continue;

      let shouldApplyTag = false;

      switch (rule.condition) {
        case "product_is":
          shouldApplyTag = product.id.toString() === rule.conditionValue;
          break;
        case "title_contains":
          // If conditionValue is a product ID, get that product's title and check if current product title contains it
          if (rule.conditionValue && !isNaN(parseInt(rule.conditionValue))) {
            // This is a product ID from the picker, we need to fetch that product's title
            try {
              const targetProductResult = await admin.graphql(`
                query getProduct($id: ID!) {
                  product(id: $id) {
                    title
                  }
                }
              `, {
                variables: {
                  id: `gid://shopify/Product/${rule.conditionValue}`
                }
              });
              
              const targetProduct = targetProductResult.data?.product;
              if (targetProduct?.title) {
                shouldApplyTag = product.title.toLowerCase().includes(targetProduct.title.toLowerCase());
              }
            } catch (error) {
              console.error("Error fetching target product:", error);
            }
          } else {
            // Fallback to direct string comparison
            shouldApplyTag = product.title.toLowerCase().includes(rule.conditionValue.toLowerCase());
          }
          break;
        case "vendor_is":
          shouldApplyTag = product.vendor?.toLowerCase() === rule.conditionValue.toLowerCase();
          break;
        case "price_over":
          const productPrice = parseFloat(product.variants?.[0]?.price || "0");
          shouldApplyTag = productPrice > parseFloat(rule.conditionValue);
          break;
        case "product_type":
          shouldApplyTag = product.product_type?.toLowerCase() === rule.conditionValue.toLowerCase();
          break;
        case "inventory_low":
          const totalInventory = product.variants?.reduce((sum: number, variant: any) => 
            sum + (parseInt(variant.inventory_quantity) || 0), 0) || 0;
          shouldApplyTag = totalInventory <= parseInt(rule.conditionValue);
          break;
        case "product_tag":
          const productTags = product.tags ? product.tags.split(",").map((tag: string) => tag.trim()) : [];
          shouldApplyTag = productTags.includes(rule.conditionValue);
          break;
        case "sku_starts_with":
          const hasMatchingSku = product.variants?.some((variant: any) => 
            variant.sku?.startsWith(rule.conditionValue));
          shouldApplyTag = hasMatchingSku;
          break;
        case "published_before":
          const publishedDate = new Date(product.published_at);
          const beforeDate = new Date(rule.conditionValue);
          shouldApplyTag = publishedDate < beforeDate;
          break;
      }

      console.log("Product rule check:", { 
        rule: rule.name, 
        condition: rule.condition, 
        shouldApply: shouldApplyTag 
      });

      if (shouldApplyTag && !currentTags.includes(rule.tag)) {
        try {
          // Add the new tag
          currentTags.push(rule.tag);

          // Update the product with new tags
          const result = await admin.graphql(`
            mutation productUpdate($input: ProductInput!) {
              productUpdate(input: $input) {
                product {
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
                id: product.admin_graphql_api_id,
                tags: currentTags.join(", ")
              }
            }
          });
          
          console.log("Product GraphQL result:", JSON.stringify(result, null, 2));
          console.log(`Successfully applied tag ${rule.tag} to product ${product.id}`);
          
          // Track tag activity
          try {
            await prisma.tagActivity.create({
              data: {
                shop,
                entityType: "Product",
                entityId: product.id.toString(),
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
          console.error(`Error updating product ${product.id}:`, error);
          return json({ 
            error: "Failed to update product tags",
            details: error instanceof Error ? error.message : "Unknown error"
          }, { status: 500 });
        }
      }
    }

    console.log("Product webhook handler completed successfully");
    return json({ success: true });
  } catch (error) {
    console.error("=== PRODUCT WEBHOOK ERROR ===");
    console.error("Product webhook handler error:", error);
    return json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}; 