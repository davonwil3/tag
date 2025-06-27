import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { prisma } from "~/db.server";
import {
  Page,
  Layout,
  Card,
  Button,
  BlockStack,
  Text,
  IndexTable,
  Badge,
  InlineStack,
  Divider,
} from "@shopify/polaris";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const rules = await prisma.rule.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });
  return json({ rules });
};

export default function Index() {
  const { rules } = useLoaderData<typeof loader>();

  // Mock data for Recent Tag Activity
  const recentActivity = [
    {
      id: "1",
      orderId: "#1001",
      tagApplied: "High Value",
      date: "2024-01-15",
    },
    {
      id: "2", 
      orderId: "#1002",
      tagApplied: "Discount Used",
      date: "2024-01-14",
    },
    {
      id: "3",
      orderId: "#1003", 
      tagApplied: "VIP Customer",
      date: "2024-01-13",
    },
    {
      id: "4",
      orderId: "#1004",
      tagApplied: "High Value",
      date: "2024-01-12",
    },
  ];

  // Mock data for Tag Usage Summary
  const tagUsage = [
    { tag: "High Value", count: 45 },
    { tag: "Discount Used", count: 23 },
    { tag: "VIP Customer", count: 12 },
    { tag: "First Time Buyer", count: 8 },
    { tag: "Returning Customer", count: 34 },
  ];

  const activityRowMarkup = recentActivity.map(
    ({ id, orderId, tagApplied, date }, index) => (
      <IndexTable.Row
        id={id}
        key={id}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {orderId}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge>{tagApplied}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {new Date(date).toLocaleDateString()}
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Page
      title="Dashboard"
      primaryAction={
        <Button variant="primary" url="/app/rules/new">
          Create Rule
        </Button>
      }
    >
      <Layout>
        {/* Recent Tag Activity Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Recent Tag Activity
              </Text>
              <IndexTable
                resourceName={{ singular: "activity", plural: "activities" }}
                itemCount={recentActivity.length}
                headings={[
                  { title: "Order ID" },
                  { title: "Tag Applied" },
                  { title: "Date" },
                ]}
                selectable={false}
              >
                {activityRowMarkup}
              </IndexTable>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Rule Summary Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Rule Summary
              </Text>
              {rules.length === 0 ? (
                <Text as="p" variant="bodyMd" tone="subdued">
                  No rules created yet. Create your first rule to get started.
                </Text>
              ) : (
                <BlockStack gap="300">
                  {rules.map((rule) => (
                    <BlockStack key={rule.id} gap="200">
                      <InlineStack align="space-between">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          {rule.name}
                        </Text>
                        <Badge>{rule.appliesTo}</Badge>
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {rule.condition === "total_greater_than" && `Order total > $${rule.conditionValue}`}
                        {rule.condition === "discount_used" && "Discount code applied"}
                        {rule.condition === "contains_item" && `Contains "${rule.conditionValue}"`}
                        {rule.condition === "total_spent" && `Customer spent > $${rule.conditionValue}`}
                        {rule.condition === "orders_placed" && `Customer has > ${rule.conditionValue} orders`}
                        {rule.condition === "has_email" && "Customer has email"}
                        {rule.condition === "title_contains" && `Title contains "${rule.conditionValue}"`}
                        {rule.condition === "vendor_is" && `Vendor is "${rule.conditionValue}"`}
                        {rule.condition === "price_over" && `Price > $${rule.conditionValue}`}
                      </Text>
                      <Text as="p" variant="bodySm">
                        Applies tag: <Badge>{rule.tag}</Badge>
                      </Text>
                    </BlockStack>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Tag Usage Summary Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Tag Usage Summary
              </Text>
              <InlineStack gap="400" wrap>
                {tagUsage.map(({ tag, count }) => (
                  <InlineStack key={tag} gap="200" align="center">
                    <Badge>{tag}</Badge>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {count}
                    </Text>
                  </InlineStack>
                ))}
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Quick Stats Section */}
        <Layout.Section>
          <Layout>
            <Layout.Section>
              <Card>
                <BlockStack gap="200" align="center">
                  <Text as="span" variant="headingLg" fontWeight="bold">
                    {rules.length}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Active Rules
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>
            <Layout.Section>
              <Card>
                <BlockStack gap="200" align="center">
                  <Text as="span" variant="headingLg" fontWeight="bold">
                    {tagUsage.reduce((sum, tag) => sum + tag.count, 0)}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Tags Applied
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>
            <Layout.Section>
              <Card>
                <BlockStack gap="200" align="center">
                  <Text as="span" variant="headingLg" fontWeight="bold">
                    {tagUsage.length}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Unique Tags
                  </Text>
                </BlockStack>
              </Card>
            </Layout.Section>
          </Layout>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
