import { useState } from "react";
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
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
  Modal,
  Tooltip,
  Banner,
} from "@shopify/polaris";
import { DeleteIcon } from '@shopify/polaris-icons';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  
  // Get rules for this shop
  const rules = await prisma.rule.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
  });
  
  // Get recent tag activity (with fallback)
  let recentActivity: any[] = [];
  try {
    recentActivity = await prisma.tagActivity.findMany({
      where: { shop: session.shop },
      orderBy: { appliedAt: "desc" },
      take: 10,
    });
  } catch (error) {
    console.log("tagActivity table not found, using empty array");
  }
  
  // Get tag usage statistics (with fallback)
  let tagUsage: any[] = [];
  try {
    tagUsage = await prisma.tagUsage.findMany({
      where: { shop: session.shop },
      orderBy: { count: "desc" },
    });
  } catch (error) {
    console.log("tagUsage table not found, using empty array");
  }
  
  return json({ rules, recentActivity, tagUsage });
};

export default function Index() {
  const { rules: initialRules, recentActivity, tagUsage } = useLoaderData<typeof loader>();
  const [rules, setRules] = useState(initialRules);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [showHelper, setShowHelper] = useState(false);
  const fetcher = useFetcher();

  const handleDelete = async (id: string) => {
    await fetcher.submit(null, {
      method: "delete",
      action: `/api/rules/${id}`,
    });
    setRules((prev) => prev.filter((r) => r.id !== id));
    setShowHelper(true);
    setConfirming(null);
  };

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
              {recentActivity.length === 0 ? (
                <Text as="p" variant="bodyMd" tone="subdued">
                  No tag activity yet. Create rules and process orders to see activity here.
                </Text>
              ) : (
                <IndexTable
                  resourceName={{ singular: "activity", plural: "activities" }}
                  itemCount={recentActivity.length}
                  headings={[
                    { title: "Entity" },
                    { title: "Tag Applied" },
                    { title: "Date" },
                  ]}
                  selectable={false}
                >
                  {recentActivity.map((activity, index) => (
                    <IndexTable.Row
                      id={activity.id}
                      key={activity.id}
                      position={index}
                    >
                      <IndexTable.Cell>
                        <Text variant="bodyMd" fontWeight="bold" as="span">
                          {activity.entityType} #{activity.entityId}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Badge>{activity.tag}</Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        {new Date(activity.appliedAt).toLocaleDateString()}
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              )}
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
              {showHelper && (
                <Banner onDismiss={() => setShowHelper(false)}>
                  Tags already applied by this rule will remain in Shopify. You can remove them manually from the Shopify admin.
                </Banner>
              )}
              {rules.length === 0 ? (
                <Text as="p" variant="bodyMd" tone="subdued">
                  No rules created yet. Create your first rule to get started.
                </Text>
              ) : (
                <BlockStack gap="0">
                  {rules.map((rule, idx) => (
                    <>
                      <div key={rule.id} style={{ padding: '20px 0' }}>
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="200" align="center">
                            <Text as="span" variant="bodyMd" fontWeight="semibold">
                              {rule.name}
                            </Text>
                            <Badge>{rule.appliesTo}</Badge>
                          </InlineStack>
                          <Tooltip content="Delete rule">
                            <Button
                              icon={DeleteIcon}
                              tone="critical"
                              onClick={() => setConfirming(rule.id)}
                              size="slim"
                              variant="plain"
                              accessibilityLabel={`Delete rule ${rule.name}`}
                            />
                          </Tooltip>
                        </InlineStack>
                        <div style={{ marginTop: 8 }}>
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
                        </div>
                        {confirming === rule.id && (
                          <Modal
                            open
                            title="Delete this rule?"
                            onClose={() => setConfirming(null)}
                            primaryAction={{
                              content: "Delete",
                              onAction: () => handleDelete(rule.id),
                            }}
                            secondaryActions={[
                              {
                                content: "Cancel",
                                onAction: () => setConfirming(null),
                              },
                            ]}
                          >
                            <Modal.Section>
                              <Text as="p">
                                Are you sure? Tags already applied by this rule will remain in Shopify. You can remove them manually from the Shopify admin.
                              </Text>
                            </Modal.Section>
                          </Modal>
                        )}
                      </div>
                      {idx < rules.length - 1 && <Divider />}
                    </>
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
              {tagUsage.length === 0 ? (
                <Text as="p" variant="bodyMd" tone="subdued">
                  No tag usage data yet. Create rules and process orders to see usage statistics.
                </Text>
              ) : (
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
              )}
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
