import { useState, useCallback } from "react";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  Button,
  Modal,
  BlockStack,
} from "@shopify/polaris";
import { json } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { prisma } from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  let settings = await prisma.merchantSettings.findUnique({ where: { shop } });
  if (!settings) {
    settings = await prisma.merchantSettings.create({ data: { shop } });
  }
  return json({});
};

export const action = async ({ request }: ActionFunctionArgs) => {
  return json({ success: true });
};

export default function Settings() {
  const fetcher = useFetcher();
  const [modalOpen, setModalOpen] = useState(false);

  const handleUpgradeClick = useCallback(() => setModalOpen(true), []);
  const handleModalClose = useCallback(() => setModalOpen(false), []);
  const handleContinue = useCallback(() => {
    window.location.href = "/app/upgrade";
  }, []);

  return (
    <Page
      title="Settings"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <Card title="Your Plan" sectioned>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h3">Free Plan</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Up to 3 rules • Basic support
              </Text>
              <Button primary onClick={handleUpgradeClick}>
                Upgrade Plan
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
      <Modal
        open={modalOpen}
        onClose={handleModalClose}
        title="Ready to Upgrade?"
        primaryAction={{
          content: "Continue",
          onAction: handleContinue,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: handleModalClose,
          },
        ]}
      >
        <Modal.Section>
          <Text as="p" variant="bodyMd">
            You'll be redirected to the billing portal to choose a paid plan. Continue?
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
} 