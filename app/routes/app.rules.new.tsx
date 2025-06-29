import { json, redirect } from "@remix-run/node";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  Banner,
  BlockStack,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { prisma } from "~/db.server";
import { DynamicConditionInput } from "~/components/DynamicConditionInput";
import { nanoid } from "nanoid";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const ruleName = formData.get("ruleName") as string;
  const appliesTo = formData.get("appliesTo") as string;
  const condition = formData.get("condition") as string;
  const conditionValue = formData.get("conditionValue") as string;
  const tagToApply = formData.get("tagToApply") as string;

  // Validate all fields
  if (!ruleName || !appliesTo || !condition || !conditionValue || !tagToApply) {
    return json({ error: "All fields are required" });
  }

  try {
    await prisma.rule.create({
      data: {
        id: nanoid(),
        name: ruleName,
        appliesTo,
        condition,
        conditionValue,
        tag: tagToApply,
        shop: session.shop,
        updatedAt: new Date(),
      },
    });

    return redirect("/app");
  } catch (error) {
    console.error("Error creating rule:", error);
    return json({ error: "Failed to create rule" });
  }
};

export default function NewRule() {
  const conditionOptions = {
    Order: [
      { label: "Total is greater than", value: "total_greater_than" },
      { label: "Total is less than", value: "total_less_than" },
      { label: "Discount used", value: "discount_used" },
      { label: "Contains specific product", value: "contains_item" },
      { label: "Shipping method", value: "shipping_method" },
      { label: "Order has tag", value: "order_tag" },
      { label: "Is first order", value: "is_first_order" },
      { label: "Fulfillment status", value: "fulfillment_status" },
    ],
    Customer: [
      { label: "Total spent", value: "total_spent" },
      { label: "Orders placed", value: "orders_placed" },
      { label: "Has email", value: "has_email" },
      { label: "Customer has tag", value: "customer_tagged" },
      { label: "Accepts marketing", value: "accepts_marketing" },
      { label: "Customer location", value: "customer_location" },
      { label: "Created before", value: "created_before" },
    ],
    Product: [
      { label: "Product is", value: "product_is" },
      { label: "Title contains", value: "title_contains" },
      { label: "Vendor is", value: "vendor_is" },
      { label: "Price is over", value: "price_over" },
      { label: "Product type", value: "product_type" },
      { label: "Inventory is low", value: "inventory_low" },
      { label: "Product has tag", value: "product_tag" },
      { label: "SKU starts with", value: "sku_starts_with" },
      { label: "Published before", value: "published_before" },
    ],
  };

  const appliesToOptions = [
    { label: "Order", value: "Order" },
    { label: "Customer", value: "Customer" },
    { label: "Product", value: "Product" },
  ];

  // Set sensible defaults
  const [appliesTo, setAppliesTo] = useState<string>("Order");
  const [condition, setCondition] = useState<string>(conditionOptions["Order"][0].value);
  const [ruleName, setRuleName] = useState("");
  const [conditionValue, setConditionValue] = useState("");
  const [tagToApply, setTagToApply] = useState("");
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const isSubmitting = navigation.state === "submitting";

  const handleAppliesToChange = useCallback(
    (value: string) => {
      setAppliesTo(value);
      const firstCondition = conditionOptions[value as keyof typeof conditionOptions]?.[0]?.value || "";
      setCondition(firstCondition);
      setConditionValue("");
    },
    []
  );

  const handleConditionChange = useCallback(
    (value: string) => {
      setCondition(value);
      setConditionValue("");
    },
    []
  );

  const handleRuleNameChange = useCallback(
    (value: string) => setRuleName(value),
    []
  );

  const handleConditionValueChange = useCallback(
    (value: string) => setConditionValue(value),
    []
  );

  const handleTagToApplyChange = useCallback(
    (value: string) => setTagToApply(value),
    []
  );

  return (
    <Page
      title="Create New Rule"
      backAction={{ content: "Rules", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          {actionData?.error && (
            <Banner tone="critical">
              <p>{actionData.error}</p>
            </Banner>
          )}
          <Card>
            <Form method="post">
              <BlockStack gap="400">
                <FormLayout>
                  <TextField
                    label="Rule Name"
                    name="ruleName"
                    autoComplete="off"
                    helpText="Give your rule a descriptive name"
                    value={ruleName}
                    onChange={handleRuleNameChange}
                  />

                  <Select
                    label="Applies to"
                    name="appliesTo"
                    options={appliesToOptions}
                    value={appliesTo}
                    onChange={handleAppliesToChange}
                  />

                  <Select
                    label="Condition"
                    name="condition"
                    options={appliesTo ? conditionOptions[appliesTo as keyof typeof conditionOptions] : []}
                    value={condition}
                    onChange={handleConditionChange}
                    disabled={!appliesTo}
                  />

                  {appliesTo && condition && (
                    <DynamicConditionInput
                      appliesTo={appliesTo}
                      condition={condition}
                      value={conditionValue}
                      onChange={handleConditionValueChange}
                    />
                  )}

                  <TextField
                    label="Tag to apply"
                    name="tagToApply"
                    autoComplete="off"
                    helpText="The tag that will be applied when the condition is met"
                    value={tagToApply}
                    onChange={handleTagToApplyChange}
                  />
                </FormLayout>

                <Banner>
                  <p>🧠 Soon you'll be able to let AI suggest rules based on your store's data.</p>
                </Banner>

                <div style={{ marginTop: "1rem" }}>
                  <Button
                    variant="primary"
                    submit
                    loading={isSubmitting}
                    fullWidth
                  >
                    Save Rule
                  </Button>
                </div>
              </BlockStack>
            </Form>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 