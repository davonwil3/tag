import React, { useState, useCallback } from "react";
import { Button, Text } from "@shopify/polaris";

interface Product {
  id: string;
  title: string;
  handle: string;
  images?: Array<{ id: string; url: string; altText?: string }>;
}

export function ProductPickerField({ onChange }: { onChange?: (product: Product | null) => void }) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const openPicker = useCallback(async () => {
    // @ts-ignore: shopify is a global injected by App Bridge
    const selected = await window.shopify.resourcePicker({ type: "product", multiple: false });
    if (selected && selected.length > 0 && "handle" in selected[0] && "images" in selected[0]) {
      const product = selected[0];
      const mappedProduct: Product = {
        id: product.id,
        title: product.title,
        handle: product.handle,
        images: product.images?.map((img: any) => ({
          id: img.id,
          url: img.originalSrc || img.url || "",
          altText: img.altText,
        })) || [],
      };
      setSelectedProduct(mappedProduct);
      onChange?.(mappedProduct);
    }
  }, [onChange]);

  return (
    <div>
      <Button onClick={openPicker} fullWidth>
        {selectedProduct ? "Change Product" : "Select Product"}
      </Button>
      {selectedProduct && (
        <div style={{ marginTop: 16 }}>
          <Text as="span" variant="bodyMd" fontWeight="semibold">{selectedProduct.title}</Text>
          <Button onClick={() => { setSelectedProduct(null); onChange?.(null); }} tone="critical" variant="plain">
            Remove
          </Button>
        </div>
      )}
    </div>
  );
} 