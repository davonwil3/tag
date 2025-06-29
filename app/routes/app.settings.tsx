import { useState, useCallback } from "react";
import { useLoaderData, useFetcher } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  SettingToggle,
  Text,
  Button,
  Modal,
  BlockStack,
  ProgressBar,
  Badge,
  Banner,
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
  return json({
    applyToPastData: settings.pastDataOptIn,
    processingPastData: settings.pastDataProcessing || false,
    pastDataProgress: settings.pastDataProgress || {
      status: "idle",
      percent: 0,
      lastUpdated: new Date().toISOString(),
    },
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const pastDataOptIn = formData.get("applyToPastData") === "true";
  await prisma.merchantSettings.upsert({
    where: { shop },
    update: { pastDataOptIn },
    create: { shop, pastDataOptIn },
  });
  return json({ success: true });
};

export default function Settings() {
  const { applyToPastData, processingPastData, pastDataProgress } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();
  const [toggle, setToggle] = useState(applyToPastData);
  const [modalOpen, setModalOpen] = useState(false);

  const handleToggle = useCallback(() => {
    setToggle((prev) => {
      fetcher.submit(
        { applyToPastData: (!prev).toString() },
        { method: "post" }
      );
      return !prev;
    });
  }, [fetcher]);

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
          <Card sectioned>
            <SettingToggle
              action={{
                content: toggle ? "Disable" : "Enable",
                onAction: handleToggle,
              }}
              enabled={toggle}
            >
              <Text variant="headingMd" as="h3">Apply rules to past data</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Automatically tag existing orders and customers based on your saved rules.
              </Text>
            </SettingToggle>
            {pastDataProgress.status === "in_progress" && (
              <>
                <ProgressBar progress={pastDataProgress.percent} size="small" />
                <Text as="p" variant="bodySm" tone="subdued">
                  Applying rules to past orders and customers…
                </Text>
                <Badge>{Math.round(pastDataProgress.percent)}% complete</Badge>
              </>
            )}
            {pastDataProgress.status === "completed" && (
              <>
                <Badge tone="success">Completed</Badge>
                <Text as="p" variant="bodySm" tone="success">
                  Rules were successfully applied to your past data.
                </Text>
              </>
            )}
            {pastDataProgress.status === "error" && (
              <Banner tone="critical">
                We couldn't finish applying rules to past data. Please try again.
              </Banner>
            )}
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card title="Your Plan" sectioned>
            <BlockStack gap="200">
              <Text variant="headingMd" as="h3">Free Plan</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Up to 3 rules • Historical tagging • Basic support
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