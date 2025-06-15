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
        name: ruleName,
        appliesTo,
        condition,
        conditionValue,
        tag: tagToApply,
        shop: session.shop,
      },
    });

    return redirect("/app");
  } catch (error) {
    console.error("Error creating rule:", error);
    return json({ error: "Failed to create rule" });
  }
};

export default function NewRule() {
  const [appliesTo, setAppliesTo] = useState<string>("");
  const [ruleName, setRuleName] = useState("");
  const [conditionValue, setConditionValue] = useState("");
  const [tagToApply, setTagToApply] = useState("");
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const isSubmitting = navigation.state === "submitting";

  const handleAppliesToChange = useCallback(
    (value: string) => setAppliesTo(value),
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

  const conditionOptions = {
    Order: [
      { label: "Total is greater than", value: "total_greater_than" },
      { label: "Discount used", value: "discount_used" },
      { label: "Contains item", value: "contains_item" },
    ],
    Customer: [
      { label: "Total spent", value: "total_spent" },
      { label: "Orders placed", value: "orders_placed" },
      { label: "Has email", value: "has_email" },
    ],
    Product: [
      { label: "Title contains", value: "title_contains" },
      { label: "Vendor is", value: "vendor_is" },
      { label: "Price is over", value: "price_over" },
    ],
  };

  const appliesToOptions = [
    { label: "Order", value: "Order" },
    { label: "Customer", value: "Customer" },
    { label: "Product", value: "Product" },
  ];

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
                    disabled={!appliesTo}
                  />

                  <TextField
                    label="Condition Value"
                    name="conditionValue"
                    autoComplete="off"
                    helpText="Enter the value to match against"
                    value={conditionValue}
                    onChange={handleConditionValueChange}
                  />

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