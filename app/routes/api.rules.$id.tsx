import { json } from "@remix-run/node";
import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "~/shopify.server";
import { prisma } from "~/db.server";

export const action = async ({ request, params }: ActionFunctionArgs) => {
  if (request.method !== "DELETE") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const { id } = params;

  // Only delete if rule belongs to this shop
  const rule = await prisma.rule.findUnique({ where: { id: id as string } });
  if (!rule || rule.shop !== shop) {
    return json({ error: "Not found or unauthorized" }, { status: 404 });
  }

  await prisma.rule.delete({ where: { id: id as string } });
  return json({ success: true });
}; 