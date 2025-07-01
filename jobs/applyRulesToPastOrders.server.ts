import { prisma } from "~/db.server";
import { shopifyRestClient } from "~/shopify.server";

export async function runPastOrdersJob(shop: string) {
  try {
    // A. Load rules
    const rules = await prisma.rule.findMany({ where: { shop } });
    if (!rules.length) return;

    // B. DISCOVERY PASS
    let matchedIds: string[] = [];
    let nextPageInfo: string | null = null;
    do {
      const res = await shopifyRestClient(shop).get(
        "/admin/api/2023-10/orders.json",
        {
          params: {
            limit: 250,
            status: "any",
            fields: "id,total_price,tags,line_items,discount_codes,shipping_lines,order_number,customer,fulfillment_status",
            page_info: nextPageInfo || undefined,
          },
        }
      );
      const orders = res.data.orders;
      for (const order of orders) {
        for (const rule of rules) {
          // (Simple example: only a few conditions, expand as needed)
          let shouldApply = false;
          switch (rule.condition) {
            case "total_greater_than":
              shouldApply = parseFloat(order.total_price) > parseFloat(rule.conditionValue);
              break;
            case "total_less_than":
              shouldApply = parseFloat(order.total_price) < parseFloat(rule.conditionValue);
              break;
            case "discount_used":
              shouldApply = order.discount_codes && order.discount_codes.length > 0;
              break;
            case "contains_item":
              shouldApply = order.line_items?.some((item: any) => item.product_id?.toString() === rule.conditionValue);
              break;
            case "shipping_method":
              shouldApply = order.shipping_lines?.some((s: any) => s.title.toLowerCase().includes(rule.conditionValue.toLowerCase()));
              break;
            case "order_tag":
              shouldApply = order.tags?.split(",").map((t: string) => t.trim()).includes(rule.conditionValue);
              break;
            case "is_first_order":
              shouldApply = order.order_number === 1 || order.customer?.orders_count === 1;
              break;
            case "fulfillment_status":
              shouldApply = order.fulfillment_status === rule.conditionValue.toLowerCase();
              break;
          }
          if (shouldApply) {
            matchedIds.push(order.id);
            break;
          }
        }
      }
      // Pagination
      const linkHeader = res.headers["link"];
      nextPageInfo = null;
      if (linkHeader) {
        const match = linkHeader.match(/<[^>]+page_info=([^&>]+)[^>]*>; rel="next"/);
        if (match) nextPageInfo = match[1];
      }
    } while (nextPageInfo);

    await prisma.merchantSettings.update({
      where: { shop },
      data: {
        pastDataProcessing: true,
        pastDataProgress: { total: matchedIds.length, processed: 0, percent: 0 },
      },
    });

    // C. TAGGING PASS
    let processed = 0;
    for (const orderId of matchedIds) {
      try {
        // 1. Update order tags (fetch, add tag, PUT)
        const orderRes = await shopifyRestClient(shop).get(`/admin/api/2023-10/orders/${orderId}.json`);
        const order = orderRes.data.order;
        let tags = order.tags ? order.tags.split(",").map((t: string) => t.trim()) : [];
        for (const rule of rules) {
          // (Repeat logic to determine which tag to apply)
          let shouldApply = false;
          switch (rule.condition) {
            case "total_greater_than":
              shouldApply = parseFloat(order.total_price) > parseFloat(rule.conditionValue);
              break;
            case "total_less_than":
              shouldApply = parseFloat(order.total_price) < parseFloat(rule.conditionValue);
              break;
            case "discount_used":
              shouldApply = order.discount_codes && order.discount_codes.length > 0;
              break;
            case "contains_item":
              shouldApply = order.line_items?.some((item: any) => item.product_id?.toString() === rule.conditionValue);
              break;
            case "shipping_method":
              shouldApply = order.shipping_lines?.some((s: any) => s.title.toLowerCase().includes(rule.conditionValue.toLowerCase()));
              break;
            case "order_tag":
              shouldApply = tags.includes(rule.conditionValue);
              break;
            case "is_first_order":
              shouldApply = order.order_number === 1 || order.customer?.orders_count === 1;
              break;
            case "fulfillment_status":
              shouldApply = order.fulfillment_status === rule.conditionValue.toLowerCase();
              break;
          }
          if (shouldApply && !tags.includes(rule.tag)) {
            tags.push(rule.tag);
          }
        }
        await shopifyRestClient(shop).put(`/admin/api/2023-10/orders/${orderId}.json`, {
          order: { id: orderId, tags: tags.join(", ") },
        });
      } catch (err) {
        // Log and continue
        console.error(`Failed to tag order ${orderId}:`, err);
      }
      processed++;
      if (processed % 25 === 0 || processed === matchedIds.length) {
        await prisma.merchantSettings.update({
          where: { shop },
          data: {
            pastDataProgress: {
              total: matchedIds.length,
              processed,
              percent: Math.round((processed / matchedIds.length) * 100),
            },
          },
        });
      }
      await new Promise((r) => setTimeout(r, 500));
    }
    await prisma.merchantSettings.update({
      where: { shop },
      data: {
        pastDataProcessing: false,
        pastDataProgress: {
          total: matchedIds.length,
          processed: matchedIds.length,
          percent: 100,
          status: "completed",
        },
      },
    });
  } catch (err) {
    console.error("Error in runPastOrdersJob:", err);
    await prisma.merchantSettings.update({
      where: { shop },
      data: {
        pastDataProcessing: false,
        pastDataProgress: { status: "error" },
      },
    });
  }
} 