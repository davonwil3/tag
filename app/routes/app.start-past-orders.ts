import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { runPastOrdersJob } from "~/jobs/applyRulesToPastOrders.server";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  runPastOrdersJob(session.shop); // fire-and-forget
  return json({ started: true });
};

export const loader = () => new Response("Method Not Allowed", { status: 405 }); 