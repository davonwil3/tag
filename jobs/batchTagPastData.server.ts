import { prisma } from "~/db.server";
import { shopifyRestClient } from "~/shopify.server";

export type EntityType = "order" | "product" | "customer";

export async function processBatch({
  shop,
  entityType,
  cursor,
}: {
  shop: string;
  entityType: EntityType;
  cursor?: string | null;
}) {
  const rules = await prisma.rule.findMany({ where: { shop } });
  if (!rules.length) return { done: true };

  let endpoint = "";
  let params: any = { limit: 25 };
  let entityKey = "";
  let idKey = "id";
  let tagKey = "tags";
  let updateEndpoint = "";
  let entityList: any[] = [];
  let nextCursor: string | null = null;

  switch (entityType) {
    case "order":
      endpoint = "/admin/api/2023-10/orders.json";
      params.status = "any";
      params.fields = "id,total_price,tags,line_items,discount_codes,shipping_lines,order_number,customer,fulfillment_status";
      if (cursor) params.page_info = cursor;
      entityKey = "orders";
      updateEndpoint = "/admin/api/2023-10/orders/";
      break;
    case "product":
      endpoint = "/admin/api/2023-10/products.json";
      params.fields = "id,title,tags,vendor,product_type,variants,published_at";
      if (cursor) params.page_info = cursor;
      entityKey = "products";
      updateEndpoint = "/admin/api/2023-10/products/";
      break;
    case "customer":
      endpoint = "/admin/api/2023-10/customers.json";
      params.fields = "id,email,tags,total_spent,orders_count,accepts_marketing,created_at,default_address";
      if (cursor) params.page_info = cursor;
      entityKey = "customers";
      updateEndpoint = "/admin/api/2023-10/customers/";
      break;
  }

  const res = await shopifyRestClient(shop).get(endpoint, { params });
  entityList = res.data[entityKey];

  // Pagination
  const linkHeader = res.headers["link"];
  nextCursor = null;
  if (linkHeader) {
    const match = linkHeader.match(/<[^>]+page_info=([^&>]+)[^>]*>; rel="next"/);
    if (match) nextCursor = match[1];
  }

  let processed = 0;
  const appliedTags: string[] = []; // Track tags applied in this batch

  for (const entity of entityList) {
    let tags = entity.tags ? entity.tags.split(",").map((t: string) => t.trim()) : [];
    const originalTags = [...tags];
    
    for (const rule of rules) {
      let shouldApply = false;
      switch (entityType) {
        case "order":
          switch (rule.condition) {
            case "total_greater_than":
              shouldApply = parseFloat(entity.total_price) > parseFloat(rule.conditionValue);
              break;
            case "total_less_than":
              shouldApply = parseFloat(entity.total_price) < parseFloat(rule.conditionValue);
              break;
            case "discount_used":
              shouldApply = entity.discount_codes && entity.discount_codes.length > 0;
              break;
            case "contains_item":
              shouldApply = entity.line_items?.some((item: any) => item.product_id?.toString() === rule.conditionValue);
              break;
            case "shipping_method":
              shouldApply = entity.shipping_lines?.some((s: any) => s.title.toLowerCase().includes(rule.conditionValue.toLowerCase()));
              break;
            case "order_tag":
              shouldApply = tags.includes(rule.conditionValue);
              break;
            case "is_first_order":
              shouldApply = entity.order_number === 1 || entity.customer?.orders_count === 1;
              break;
            case "fulfillment_status":
              shouldApply = entity.fulfillment_status === rule.conditionValue.toLowerCase();
              break;
          }
          break;
        case "product":
          switch (rule.condition) {
            case "product_is":
              shouldApply = entity.id.toString() === rule.conditionValue;
              break;
            case "title_contains":
              shouldApply = entity.title.toLowerCase().includes(rule.conditionValue.toLowerCase());
              break;
            case "vendor_is":
              shouldApply = entity.vendor?.toLowerCase() === rule.conditionValue.toLowerCase();
              break;
            case "price_over":
              shouldApply = entity.variants?.[0]?.price && parseFloat(entity.variants[0].price) > parseFloat(rule.conditionValue);
              break;
            case "product_type":
              shouldApply = entity.product_type?.toLowerCase() === rule.conditionValue.toLowerCase();
              break;
            case "product_tag":
              shouldApply = tags.includes(rule.conditionValue);
              break;
            case "sku_starts_with":
              shouldApply = entity.variants?.some((v: any) => v.sku?.startsWith(rule.conditionValue));
              break;
            case "published_before":
              shouldApply = new Date(entity.published_at) < new Date(rule.conditionValue);
              break;
          }
          break;
        case "customer":
          switch (rule.condition) {
            case "total_spent":
              shouldApply = parseFloat(entity.total_spent || "0") > parseFloat(rule.conditionValue);
              break;
            case "orders_placed":
              shouldApply = parseInt(entity.orders_count || "0") > parseInt(rule.conditionValue);
              break;
            case "has_email":
              shouldApply = rule.conditionValue === "Yes" ? !!entity.email : !entity.email;
              break;
            case "customer_tagged":
              shouldApply = tags.includes(rule.conditionValue);
              break;
            case "accepts_marketing":
              shouldApply = rule.conditionValue === "Yes" ? entity.accepts_marketing : !entity.accepts_marketing;
              break;
            case "customer_location":
              shouldApply = entity.default_address?.country_code === rule.conditionValue;
              break;
            case "created_before":
              shouldApply = new Date(entity.created_at) < new Date(rule.conditionValue);
              break;
          }
          break;
      }
      if (shouldApply && !tags.includes(rule.tag)) {
        tags.push(rule.tag);
        appliedTags.push(rule.tag);
      }
    }
    
    // Only update if tags changed
    if (tags.join(",") !== entity.tags) {
      try {
        await shopifyRestClient(shop).put(`${updateEndpoint}${entity[idKey]}.json`, {
          [entityType]: { id: entity[idKey], tags: tags.join(", ") },
        });

        // Track tag activity for newly applied tags
        const newTags = tags.filter(tag => !originalTags.includes(tag));
        for (const tag of newTags) {
          try {
            // Record tag activity
            await prisma.tagActivity.create({
              data: {
                shop,
                entityType: entityType.charAt(0).toUpperCase() + entityType.slice(1), // Capitalize
                entityId: entity[idKey].toString(),
                tag,
                ruleId: rules.find(r => r.tag === tag)?.id,
              },
            });

            // Update tag usage statistics
            await prisma.tagUsage.upsert({
              where: { shop_tag: { shop, tag } },
              update: {
                count: { increment: 1 },
                lastUsed: new Date(),
              },
              create: {
                shop,
                tag,
                count: 1,
                lastUsed: new Date(),
              },
            });
          } catch (err) {
            console.error(`Failed to track tag activity for ${tag}:`, err);
          }
        }
      } catch (err) {
        console.error(`Failed to tag ${entityType} ${entity[idKey]}:`, err);
      }
    }
    processed++;
    await new Promise((r) => setTimeout(r, 500));
  }

  // Update progress and cursor in DB
  await prisma.merchantSettings.update({
    where: { shop },
    data: {
      [`${entityType}BatchCursor`]: nextCursor,
      [`${entityType}BatchProgress`]: {
        processed,
        batchSize: entityList.length,
        done: !nextCursor,
        appliedTags: appliedTags.length > 0 ? appliedTags : undefined,
      },
    },
  });

  return {
    nextCursor,
    processed,
    batchSize: entityList.length,
    done: !nextCursor,
    appliedTags: appliedTags.length > 0 ? appliedTags : undefined,
  };
} 