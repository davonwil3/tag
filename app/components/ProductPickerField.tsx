import React, { useState, useCallback } from "react";
import { Button, FormLayout, Text, HiddenInput } from "@shopify/polaris";
import { ResourcePicker } from "@shopify/app-bridge-react";

interface Product {
  id: string;
  title: string;
  handle: string;
  images: Array<{
    id: string;
    url: string;
    altText: string;
  }>;
  variants: Array<{
    id: string;
    title: string;
    price: string;
  }>;
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(initialSelection || null);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const handleProductSelect = useCallback((resources: any) => {
    const selectedResources = resources.selection;
    
    if (selectedResources.length > 0) {
      const product = selectedResources[0];
      const productData: Product = {
        id: product.id,
        title: product.title,
        handle: product.handle,
        images: product.images || [],
        variants: product.variants || [],
      };
      
      setSelectedProduct(productData);
      onChange?.(productData);
    } else {
      setSelectedProduct(null);
      onChange?.(null);
    }
    
    setIsPickerOpen(false);
  }, [onChange]);

  const handleClearSelection = useCallback(() => {
    setSelectedProduct(null);
    onChange?.(null);
  }, [onChange]);

  const handleOpenPicker = useCallback(() => {
    setIsPickerOpen(true);
  }, []);

  return (
    <FormLayout>
      <div>
        <Text as="label" variant="bodyMd" fontWeight="semibold">
          {label}
        </Text>
        
        <div style={{ marginTop: "0.5rem" }}>
          <Button
            onClick={handleOpenPicker}
            variant="secondary"
            size="large"
            fullWidth
          >
            {selectedProduct ? "Change Product" : "Select Product"}
          </Button>
        </div>

        {selectedProduct && (
          <div style={{ marginTop: "1rem" }}>
            <div style={{ 
              padding: "1rem", 
              border: "1px solid #e1e3e5", 
              borderRadius: "8px",
              backgroundColor: "#f6f6f7"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                {selectedProduct.images?.[0]?.url && (
                  <img
                    src={selectedProduct.images[0].url}
                    alt={selectedProduct.title}
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "4px",
                      objectFit: "cover"
                    }}
                  />
                )}
                <div style={{ flex: 1 }}>
                  <Text as="p" variant="bodyMd" fontWeight="semibold">
                    {selectedProduct.title}
                  </Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    ID: {selectedProduct.id.split('/').pop()}
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
        <HiddenInput
          name="conditionValue"
          value={selectedProduct?.id || ""}
        />
      </div>

      <ResourcePicker
        resourceType="Product"
        showVariants={false}
        allowMultiple={false}
        open={isPickerOpen}
        onCancel={() => setIsPickerOpen(false)}
        onSelection={handleProductSelect}
        initialSelectionIds={selectedProduct ? [selectedProduct.id] : []}
      />
    </FormLayout>
  );
} 