import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useActionData } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Button,
  Banner,
  BlockStack,
  Text,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { authenticate } from "../shopify.server";
import { ProductPickerField } from "~/components/ProductPickerField";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

export default function TestProductPicker() {
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [formData, setFormData] = useState({ ruleName: "", tagToApply: "" });
  const actionData = useActionData<typeof loader>();

  const handleProductChange = useCallback((product: any) => {
    setSelectedProduct(product);
    console.log("Selected product:", product);
  }, []);

  const handleFormChange = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(() => {
    console.log("Form submitted with:", {
      ...formData,
      selectedProduct: selectedProduct?.id || "No product selected"
    });
  }, [formData, selectedProduct]);

  return (
    <Page
      title="Test Product Picker"
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Product Picker Test
              </Text>
              
              <FormLayout>
                <TextField
                  label="Rule Name"
                  value={formData.ruleName}
                  onChange={(value) => handleFormChange("ruleName", value)}
                  placeholder="Enter rule name"
                />

                <ProductPickerField
                  label="Select Product for Rule"
                  onChange={handleProductChange}
                  helpText="Choose a specific product that this rule will apply to"
                />

                <TextField
                  label="Tag to Apply"
                  value={formData.tagToApply}
                  onChange={(value) => handleFormChange("tagToApply", value)}
                  placeholder="Enter tag name"
                />

                <Button
                  variant="primary"
                  onClick={handleSubmit}
                  fullWidth
                >
                  Test Submit
                </Button>
              </FormLayout>

              {selectedProduct && (
                <Banner tone="success">
                  <p>
                    <strong>Selected Product:</strong> {selectedProduct.title}
                    <br />
                    <strong>Product ID:</strong> {selectedProduct.id}
                  </p>
                </Banner>
              )}

              <Banner>
                <p>
                  This page demonstrates the ProductPickerField component. 
                  The selected product ID will be stored in a hidden input field 
                  named "conditionValue" for form submission.
                </p>
              </Banner>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
} 