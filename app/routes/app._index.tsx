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
  ProgressBar,
  Box,
} from "@shopify/polaris";
import { DeleteIcon } from '@shopify/polaris-icons';
import React from "react";

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
  
  // Get merchantSettings for batch processing
  const settings = await prisma.merchantSettings.findUnique({ where: { shop: session.shop } });

  // Batch progress for each entity type
  const batchProgress = {
    order: settings?.orderBatchProgress as any || null,
    product: settings?.productBatchProgress as any || null,
    customer: settings?.customerBatchProgress as any || null,
  };

  return json({
    rules,
    recentActivity,
    tagUsage,
    batchProgress,
  });
};

export default function Index() {
  const { 
    rules: initialRules, 
    recentActivity, 
    tagUsage, 
    batchProgress 
  } = useLoaderData<typeof loader>();
  
  const [rules, setRules] = useState(initialRules);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [showHelper, setShowHelper] = useState(false);
  const fetcher = useFetcher();

  // Poll for progress every 5s while any processing is activ
  React.useEffect(() => {
    const isProcessing = 
      (batchProgress.order && !batchProgress.order.done) ||
      (batchProgress.product && !batchProgress.product.done) ||
      (batchProgress.customer && !batchProgress.customer.done);
    
    if (!isProcessing) return;
    const id = setInterval(() => fetcher.load("/app"), 5000);
    return () => clearInterval(id);
  }, [batchProgress]);

  const handleDelete = async (id: string) => {
    await fetcher.submit(null, {
      method: "delete",
      action: `/api/rules/${id}`,
    });
    setRules((prev) => prev.filter((r) => r.id !== id));
    setShowHelper(true);
    setConfirming(null);
  };

  const startBatchProcessing = (entityType: string) => {
    fetcher.submit(null, {
      method: "post",
      action: `/api/batch/${entityType}`,
    });
  };

  const getProgressPercent = (progress: any) => {
    if (!progress) return 0;
    if (progress.done) return 100;
    // Calculate based on processed vs total if available
    if (progress.processed && progress.batchSize) {
      return Math.min((progress.processed / progress.batchSize) * 100, 99);
    }
    return 0;
  };

  const isProcessing = (entityType: string) => {
    const progress = batchProgress[entityType as keyof typeof batchProgress];
    return progress && !progress.done;
  };

  const isCompleted = (entityType: string) => {
    const progress = batchProgress[entityType as keyof typeof batchProgress];
    return progress && progress.done;
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
        {/* Batch Processing Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Batch Processing
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Process existing orders, products, and customers with your tagging rules.
              </Text>
              
              <BlockStack gap="300">
                {/* Orders */}
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingSm">Orders</Text>
                      <Button
                        variant="primary"
                        size="slim"
                        loading={isProcessing('order')}
                        disabled={isProcessing('order')}
                        onClick={() => startBatchProcessing('order')}
                      >
                        {isCompleted('order') ? 'Re-process' : 'Process Orders'}
                      </Button>
                    </InlineStack>
                    {isProcessing('order') && (
                      <BlockStack gap="200">
                        <ProgressBar progress={getProgressPercent(batchProgress.order)} size="small" />
                        <Text as="span" tone="subdued" variant="bodySm">
                          Processing orders... {batchProgress.order?.processed || 0} processed
                        </Text>
                      </BlockStack>
                    )}
                    {isCompleted('order') && (
                      <Badge tone="success">Completed</Badge>
                    )}
                  </BlockStack>
                </Box>

                {/* Products */}
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingSm">Products</Text>
                      <Button
                        variant="primary"
                        size="slim"
                        loading={isProcessing('product')}
                        disabled={isProcessing('product')}
                        onClick={() => startBatchProcessing('product')}
                      >
                        {isCompleted('product') ? 'Re-process' : 'Process Products'}
                      </Button>
                    </InlineStack>
                    {isProcessing('product') && (
                      <BlockStack gap="200">
                        <ProgressBar progress={getProgressPercent(batchProgress.product)} size="small" />
                        <Text as="span" tone="subdued" variant="bodySm">
                          Processing products... {batchProgress.product?.processed || 0} processed
                        </Text>
                      </BlockStack>
                    )}
                    {isCompleted('product') && (
                      <Badge tone="success">Completed</Badge>
                    )}
                  </BlockStack>
                </Box>

                {/* Customers */}
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="200">
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h3" variant="headingSm">Customers</Text>
                      <Button
                        variant="primary"
                        size="slim"
                        loading={isProcessing('customer')}
                        disabled={isProcessing('customer')}
                        onClick={() => startBatchProcessing('customer')}
                      >
                        {isCompleted('customer') ? 'Re-process' : 'Process Customers'}
                      </Button>
                    </InlineStack>
                    {isProcessing('customer') && (
                      <BlockStack gap="200">
                        <ProgressBar progress={getProgressPercent(batchProgress.customer)} size="small" />
                        <Text as="span" tone="subdued" variant="bodySm">
                          Processing customers... {batchProgress.customer?.processed || 0} processed
                        </Text>
                      </BlockStack>
                    )}
                    {isCompleted('customer') && (
                      <Badge tone="success">Completed</Badge>
                    )}
                  </BlockStack>
                </Box>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

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
                          <BlockStack gap="100">
                            <Text as="h3" variant="headingSm">
                              {rule.name}
                            </Text>
                            <Text as="p" variant="bodyMd" tone="subdued">
                              {rule.appliesTo} • {rule.condition} {rule.conditionValue} → {rule.tag}
                            </Text>
                          </BlockStack>
                          <InlineStack gap="200" blockAlign="center">
                            <Badge tone={rule.isActive ? "success" : "critical"}>
                              {rule.isActive ? "Active" : "Inactive"}
                            </Badge>
                            <Tooltip content="Delete rule">
                              <Button
                                icon={DeleteIcon}
                                variant="plain"
                                tone="critical"
                                onClick={() => setConfirming(rule.id)}
                              />
                            </Tooltip>
                          </InlineStack>
                        </InlineStack>
                      </div>
                      {idx < rules.length - 1 && <Divider />}
                    </>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Tag Usage Section */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Tag Usage Statistics
              </Text>
              {tagUsage.length === 0 ? (
                <Text as="p" variant="bodyMd" tone="subdued">
                  No tag usage data yet. Process orders, products, or customers to see statistics here.
                </Text>
              ) : (
                <IndexTable
                  resourceName={{ singular: "tag", plural: "tags" }}
                  itemCount={tagUsage.length}
                  headings={[
                    { title: "Tag" },
                    { title: "Usage Count" },
                    { title: "Last Used" },
                  ]}
                  selectable={false}
                >
                  {tagUsage.map((usage, index) => (
                    <IndexTable.Row
                      id={usage.id}
                      key={usage.id}
                      position={index}
                    >
                      <IndexTable.Cell>
                        <Badge>{usage.tag}</Badge>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        <Text variant="bodyMd" as="span">
                          {usage.count}
                        </Text>
                      </IndexTable.Cell>
                      <IndexTable.Cell>
                        {new Date(usage.lastUsed).toLocaleDateString()}
                      </IndexTable.Cell>
                    </IndexTable.Row>
                  ))}
                </IndexTable>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!confirming}
        onClose={() => setConfirming(null)}
        title="Delete Rule"
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: () => confirming && handleDelete(confirming),
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
            Are you sure you want to delete this rule? This action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}