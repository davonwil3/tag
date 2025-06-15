import fetch from "node-fetch";

const mockOrder = {
  id: 1234567890,
  total_price: "120.00",
  discount_codes: [],
  line_items: [{ title: "Sample Product" }],
  tags: "",
};

async function testOrderWebhook() {
  try {
    const response = await fetch("http://localhost:57879/webhooks/orders/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Add Shopify webhook headers
        "X-Shopify-Topic": "orders/create",
        "X-Shopify-Hmac-SHA256": "mock-hmac", // In real webhooks, this would be a valid HMAC
        "X-Shopify-Shop-Domain": "test-store.myshopify.com",
        "X-Shopify-API-Version": "2025-04",
      },
      body: JSON.stringify(mockOrder),
    });

    const text = await response.text();
    try {
      const data = JSON.parse(text);
      console.log("Webhook response (JSON):", data);
    } catch {
      console.log("Webhook response (text):", text);
    }
  } catch (error) {
    console.error("Error testing webhook:", error);
  }
}

testOrderWebhook(); 