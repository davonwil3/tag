import React, { useState, useCallback } from "react";
import { Button, FormLayout, Text } from "@shopify/polaris";
import { useAppBridge } from "@shopify/app-bridge-react";
import { ResourcePicker } from "@shopify/app-bridge/actions";

interface Product {
  id: string;
  title: string;
  handle: string;
  images?: Array<{ id: string; url: string; altText?: string }>;
}

interface ProductPickerFieldProps {
  label?: string;
  initialSelection?: Product;
  onChange?: (product: Product | null) => void;
  error?: string;
  helpText?: string;
}

export function ProductPickerField({
  label = "Select Product",
  initialSelection,
  onChange,
  error,
  helpText,
}: ProductPickerFieldProps) {
  const app = useAppBridge();
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(initialSelection || null);

  const openPicker = useCallback(() => {
    console.log("Opening picker...");
    console.log("App bridge instance:", app);
    console.log("App bridge type:", typeof app);
    console.log("App bridge methods:", app ? Object.getOwnPropertyNames(app) : "No app");
    
    if (!app) {
      console.error("App Bridge not initialized. Make sure you're running this in the Shopify admin.");
      alert("Product picker requires Shopify admin context. Please open this app from within your Shopify admin.");
      return;
    }
    
   
    
    try {
      const picker = ResourcePicker.create(app, {
        resourceType: ResourcePicker.ResourceType.Product,
        options: {
          selectMultiple: false,
          showVariants: false,
          initialSelectionIds: selectedProduct
            ? [{ id: selectedProduct.id }]
            : [],
        },
      });
      
      console.log("Picker created successfully:", picker);

      picker.subscribe(ResourcePicker.Action.SELECT, (payload) => {
        console.log("SELECT event received:", payload);
        const selection = payload.selection;
        if (selection && selection.length > 0) {
          const product = selection[0];
          setSelectedProduct(product);
          onChange?.(product);
        }
        picker.dispatch(ResourcePicker.Action.CLOSE);
      });

      picker.subscribe(ResourcePicker.Action.CANCEL, () => {
        console.log("CANCEL event received");
        picker.dispatch(ResourcePicker.Action.CLOSE);
      });

      console.log("Dispatching OPEN action...");
      picker.dispatch(ResourcePicker.Action.OPEN);
    } catch (error) {
      console.error("Error creating or opening picker:", error);
      console.error("Error details:", error.message, error.stack);
      alert("Failed to open product picker. Please try again or contact support.");
    }
  }, [app, selectedProduct, onChange]);

  const handleClearSelection = useCallback(() => {
    setSelectedProduct(null);
    onChange?.(null);
  }, [onChange]);

  return (
    <FormLayout>
      <div>
        <Text as="label" variant="bodyMd" fontWeight="semibold">
          {label}
        </Text>
        <div style={{ marginTop: "0.5rem" }}>
          <Button
            onClick={openPicker}
            variant="secondary"
            size="large"
            fullWidth
          >
            {selectedProduct ? "Change Product" : "Select Product"}
          </Button>
        </div>
        {selectedProduct && (
          <div style={{ marginTop: "1rem" }}>
            <div
              style={{
                padding: "1rem",
                border: "1px solid #e1e3e5",
                borderRadius: "8px",
                backgroundColor: "#f6f6f7",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {selectedProduct.images?.[0]?.url && (
                  <img
                    src={selectedProduct.images[0].url}
                    alt={selectedProduct.title}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "4px",
                      objectFit: "cover",
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    {selectedProduct.title}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    ID: {selectedProduct.id.split("/").pop()}
                  </Text>
                </div>
                <Button
                  onClick={handleClearSelection}
                  variant="plain"
                  tone="critical"
                  size="small"
                >
                  Remove
                </Button>
              </div>
            </div>
          </div>
        )}
        {helpText && (
          <Text as="p" variant="bodySm" tone="subdued" style={{ marginTop: "0.5rem" }}>
            {helpText}
          </Text>
        )}
        {error && (
          <Text as="p" variant="bodySm" tone="critical" style={{ marginTop: "0.5rem" }}>
            {error}
          </Text>
        )}
        {/* Hidden input for form submission */}
        <input
          type="hidden"
          name="conditionValue"
          value={selectedProduct?.id || ""}
        />
      </div>
    </FormLayout>
  );
} 