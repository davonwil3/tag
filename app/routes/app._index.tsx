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
  EmptyState,
  IndexTable,
  Badge,
  useIndexResourceState,
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
  const resourceName = {
    singular: "rule",
    plural: "rules",
  };

  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(rules);

  const rowMarkup = rules.map(
    ({ id, name, appliesTo, condition, conditionValue, tag, createdAt }, index) => (
      <IndexTable.Row
        id={id}
        key={id}
        selected={selectedResources.includes(id)}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {name}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge>{appliesTo}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>{condition}</IndexTable.Cell>
        <IndexTable.Cell>{conditionValue}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge>{tag}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {new Date(createdAt).toLocaleDateString()}
        </IndexTable.Cell>
      </IndexTable.Row>
    )
  );

  return (
    <Page
      title="Tag Rules"
      primaryAction={
        <Button variant="primary" url="/app/rules/new">
          Create Rule
        </Button>
      }
    >
      <Layout>
        <Layout.Section>
          {rules.length === 0 ? (
            <Card>
              <EmptyState
                heading="Create your first tagging rule"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                action={{ content: "Create Rule", url: "/app/rules/new" }}
              >
                <p>Create rules to automatically tag your products based on conditions.</p>
              </EmptyState>
            </Card>
          ) : (
            <Card>
              <IndexTable
                resourceName={resourceName}
                itemCount={rules.length}
                selectedItemsCount={
                  allResourcesSelected ? "All" : selectedResources.length
                }
                onSelectionChange={handleSelectionChange}
                headings={[
                  { title: "Rule Name" },
                  { title: "Applies To" },
                  { title: "Condition" },
                  { title: "Value" },
                  { title: "Tag" },
                  { title: "Created" },
                ]}
              >
                {rowMarkup}
              </IndexTable>
            </Card>
          )}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Why use TagLogic?
              </Text>
              <BlockStack gap="200">
                <Text as="p" variant="bodyMd">
                  • Tag high-value orders automatically
                </Text>
                <Text as="p" variant="bodyMd">
                  • Segment customers for email targeting
                </Text>
                <Text as="p" variant="bodyMd">
                  • Keep products organized with keyword-based tags
                </Text>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Coming Soon
              </Text>
              <Text as="p" variant="bodyMd">
                We're working on AI-powered rule suggestions to make tag management even easier.
              </Text>
              <Button disabled>
                🧠 Suggest a rule with AI (coming soon)
              </Button>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
