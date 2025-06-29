import { prisma } from "~/db.server";
import Bottleneck from "bottleneck";

// Helper to apply rules to past data (smart implementation)
export async function applyRulesToPastData(shop: string, admin: any) {
  // 1. Fetch all rules for this shop
  const rules = await prisma.rule.findMany({ where: { shop } });
  if (!rules.length) return;

  // Set up progress tracking
  await prisma.merchantSettings.update({
    where: { shop },
    data: {
      pastDataProgress: {
        status: "in_progress",
        percent: 0,
        lastUpdated: new Date().toISOString(),
      },
      pastDataProcessing: true,
    },
  });

  // Bottleneck for rate limiting (2 req/sec)
  const limiter = new Bottleneck({ minTime: 500, maxConcurrent: 1 });
  let processed = 0;
  let total = 0;
  let error = false;

  // Helper for exponential backoff
  async function withRetry(fn: () => Promise<any>, retries = 5) {
    let attempt = 0;
    let delay = 1000;
    while (attempt < retries) {
      try {
        return await fn();
      } catch (err: any) {
        if (err?.response?.status === 429) {
          const retryAfter = parseInt(err.response.headers["retry-after"] || "0", 10);
          await new Promise((res) => setTimeout(res, retryAfter ? retryAfter * 1000 : delay));
          delay *= 2;
        } else {
          throw err;
        }
      }
      attempt++;
    }
    throw new Error("Max retries reached");
  }

  // 2. Fetch all past orders (paginated)
  let orders: any[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;
  while (hasNextPage) {
    const res: any = await withRetry(() => admin.graphql(`
      query getOrders($cursor: String) {
        orders(first: 250, after: $cursor, reverse: true) {
          pageInfo { hasNextPage endCursor }
          edges {
            cursor
            node {
              id
              name
              tags
              totalPrice
              discountCodes { code }
              lineItems(first: 10) { edges { node { product { id } } } }
              shippingLines { title }
              fulfillmentStatus
              orderNumber
              customer { id ordersCount }
            }
          }
        }
      }
    `, { variables: { cursor } }));
    const data: any = res.data.orders;
    orders.push(...data.edges.map((e: any) => e.node));
    hasNextPage = data.pageInfo.hasNextPage;
    cursor = data.pageInfo.endCursor;
    total += data.edges.length;
    // Update progress
    await prisma.merchantSettings.update({
      where: { shop },
      data: {
        pastDataProgress: {
          status: "in_progress",
          percent: (processed / (total || 1)) * 100,
          lastUpdated: new Date().toISOString(),
        },
      },
    });
  }

  // 3. Fetch all past customers (paginated)
  let customers: any[] = [];
  hasNextPage = true;
  cursor = null;
  while (hasNextPage) {
    const res: any = await withRetry(() => admin.graphql(`
      query getCustomers($cursor: String) {
        customers(first: 250, after: $cursor, reverse: true) {
          pageInfo { hasNextPage endCursor }
          edges {
            cursor
            node {
              id
              email
              tags
              totalSpent
              ordersCount
              acceptsMarketing
              createdAt
              defaultAddress { countryCode }
            }
          }
        }
      }
    `, { variables: { cursor } }));
    const data: any = res.data.customers;
    customers.push(...data.edges.map((e: any) => e.node));
    hasNextPage = data.pageInfo.hasNextPage;
    cursor = data.pageInfo.endCursor;
    total += data.edges.length;
    await prisma.merchantSettings.update({
      where: { shop },
      data: {
        pastDataProgress: {
          status: "in_progress",
          percent: (processed / (total || 1)) * 100,
          lastUpdated: new Date().toISOString(),
        },
      },
    });
  }

  // 3b. Fetch all past products (paginated)
  let products: any[] = [];
  hasNextPage = true;
  cursor = null;
  while (hasNextPage) {
    const res: any = await withRetry(() => admin.graphql(`
      query getProducts($cursor: String) {
        products(first: 250, after: $cursor, reverse: true) {
          pageInfo { hasNextPage endCursor }
          edges {
            cursor
            node {
              id
              title
              tags
              vendor
              productType
              priceRange { minVariantPrice { amount } }
              publishedAt
              sku: variants(first: 1) { edges { node { sku } } }
            }
          }
        }
      }
    `, { variables: { cursor } }));
    const data: any = res.data.products;
    products.push(...data.edges.map((e: any) => e.node));
    hasNextPage = data.pageInfo.hasNextPage;
    cursor = data.pageInfo.endCursor;
    total += data.edges.length;
    await prisma.merchantSettings.update({
      where: { shop },
      data: {
        pastDataProgress: {
          status: "in_progress",
          percent: (processed / (total || 1)) * 100,
          lastUpdated: new Date().toISOString(),
        },
      },
    });
  }

  // 4. Apply rules to orders
  for (const order of orders) {
    await limiter.schedule(async () => {
      let currentTags = order.tags ? order.tags.split(",").map((t: string) => t.trim()) : [];
      for (const rule of rules.filter(r => r.appliesTo === "Order")) {
        let shouldApply = false;
        switch (rule.condition) {
          case "total_greater_than":
            shouldApply = parseFloat(order.totalPrice) > parseFloat(rule.conditionValue);
            break;
          case "total_less_than":
            shouldApply = parseFloat(order.totalPrice) < parseFloat(rule.conditionValue);
            break;
          case "discount_used":
            shouldApply = order.discountCodes && order.discountCodes.length > 0;
            break;
          case "contains_item":
            shouldApply = order.lineItems?.edges.some((item: any) => item.node.product?.id?.endsWith(rule.conditionValue));
            break;
          case "shipping_method":
            shouldApply = order.shippingLines?.some((s: any) => s.title.toLowerCase().includes(rule.conditionValue.toLowerCase()));
            break;
          case "order_tag":
            shouldApply = currentTags.includes(rule.conditionValue);
            break;
          case "is_first_order":
            shouldApply = order.orderNumber === 1 || order.customer?.ordersCount === 1;
            break;
          case "fulfillment_status":
            shouldApply = order.fulfillmentStatus === rule.conditionValue.toLowerCase();
            break;
        }
        if (shouldApply && !currentTags.includes(rule.tag)) {
          currentTags.push(rule.tag);
        }
      }
      // Update tags if changed
      if (currentTags.join(",") !== order.tags) {
        await withRetry(() => admin.graphql(`
          mutation orderUpdate($input: OrderInput!) {
            orderUpdate(input: $input) {
              order { id tags }
              userErrors { field message }
            }
          }
        `, { variables: { input: { id: order.id, tags: currentTags.join(", ") } } }));
      }
      processed++;
      if (processed % 100 === 0) {
        await prisma.merchantSettings.update({
          where: { shop },
          data: {
            pastDataProgress: {
              status: "in_progress",
              percent: (processed / (total || 1)) * 100,
              lastUpdated: new Date().toISOString(),
            },
          },
        });
      }
    });
  }

  // 5. Apply rules to customers
  for (const customer of customers) {
    await limiter.schedule(async () => {
      let currentTags = customer.tags ? customer.tags.split(",").map((t: string) => t.trim()) : [];
      for (const rule of rules.filter(r => r.appliesTo === "Customer")) {
        let shouldApply = false;
        switch (rule.condition) {
          case "total_spent":
            shouldApply = parseFloat(customer.totalSpent || "0") > parseFloat(rule.conditionValue);
            break;
          case "orders_placed":
            shouldApply = parseInt(customer.ordersCount || "0") > parseInt(rule.conditionValue);
            break;
          case "has_email":
            shouldApply = rule.conditionValue === "Yes" ? !!customer.email : !customer.email;
            break;
          case "customer_tagged":
            shouldApply = currentTags.includes(rule.conditionValue);
            break;
          case "accepts_marketing":
            shouldApply = rule.conditionValue === "Yes" ? customer.acceptsMarketing : !customer.acceptsMarketing;
            break;
          case "customer_location":
            shouldApply = customer.defaultAddress?.countryCode === rule.conditionValue;
            break;
          case "created_before":
            shouldApply = new Date(customer.createdAt) < new Date(rule.conditionValue);
            break;
        }
        if (shouldApply && !currentTags.includes(rule.tag)) {
          currentTags.push(rule.tag);
        }
      }
      // Update tags if changed
      if (currentTags.join(",") !== customer.tags) {
        await withRetry(() => admin.graphql(`
          mutation customerUpdate($input: CustomerInput!) {
            customerUpdate(input: $input) {
              customer { id tags }
              userErrors { field message }
            }
          }
        `, { variables: { input: { id: customer.id, tags: currentTags.join(", ") } } }));
      }
      processed++;
      if (processed % 100 === 0) {
        await prisma.merchantSettings.update({
          where: { shop },
          data: {
            pastDataProgress: {
              status: "in_progress",
              percent: (processed / (total || 1)) * 100,
              lastUpdated: new Date().toISOString(),
            },
          },
        });
      }
    });
  }

  // 6. Apply rules to products
  for (const product of products) {
    await limiter.schedule(async () => {
      let currentTags = product.tags ? product.tags.split(",").map((t: string) => t.trim()) : [];
      for (const rule of rules.filter(r => r.appliesTo === "Product")) {
        let shouldApply = false;
        switch (rule.condition) {
          case "product_is":
            shouldApply = product.id.endsWith(rule.conditionValue);
            break;
          case "title_contains":
            shouldApply = product.title.toLowerCase().includes(rule.conditionValue.toLowerCase());
            break;
          case "vendor_is":
            shouldApply = product.vendor?.toLowerCase() === rule.conditionValue.toLowerCase();
            break;
          case "price_over":
            shouldApply = parseFloat(product.priceRange?.minVariantPrice?.amount || "0") > parseFloat(rule.conditionValue);
            break;
          case "product_type":
            shouldApply = product.productType?.toLowerCase() === rule.conditionValue.toLowerCase();
            break;
          case "inventory_low":
            // Not available in this query, skip
            break;
          case "product_tag":
            shouldApply = currentTags.includes(rule.conditionValue);
            break;
          case "sku_starts_with":
            shouldApply = product.sku?.edges?.[0]?.node?.sku?.startsWith(rule.conditionValue);
            break;
          case "published_before":
            shouldApply = new Date(product.publishedAt) < new Date(rule.conditionValue);
            break;
        }
        if (shouldApply && !currentTags.includes(rule.tag)) {
          currentTags.push(rule.tag);
        }
      }
      // Update tags if changed
      if (currentTags.join(",") !== product.tags) {
        await withRetry(() => admin.graphql(`
          mutation productUpdate($input: ProductInput!) {
            productUpdate(input: $input) {
              product { id tags }
              userErrors { field message }
            }
          }
        `, { variables: { input: { id: product.id, tags: currentTags.join(", ") } } }));
      }
      processed++;
      if (processed % 100 === 0) {
        await prisma.merchantSettings.update({
          where: { shop },
          data: {
            pastDataProgress: {
              status: "in_progress",
              percent: (processed / (total || 1)) * 100,
              lastUpdated: new Date().toISOString(),
            },
          },
        });
      }
    });
  }

  // Done
  await prisma.merchantSettings.update({
    where: { shop },
    data: {
      pastDataProgress: {
        status: error ? "error" : "completed",
        percent: 100,
        lastUpdated: new Date().toISOString(),
      },
      pastDataProcessing: false,
    },
  });
}

// Helper to update pastDataOptIn in merchantSettings
export async function setPastDataOptIn(shop: string, value: boolean) {
  await prisma.merchantSettings.upsert({
    where: { shop },
    update: { pastDataOptIn: value },
    create: { shop, pastDataOptIn: value },
  });
} 