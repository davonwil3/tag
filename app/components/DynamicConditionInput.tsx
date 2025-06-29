import React, { useState, useCallback } from "react";
import {
  TextField,
  Select,
  DatePicker,
  FormLayout,
  Text,
} from "@shopify/polaris";
import { ProductPickerField } from "./ProductPickerField";

interface DynamicConditionInputProps {
  appliesTo: string;
  condition: string;
  value?: string;
  onChange?: (value: string) => void;
  error?: string;
}

function SingleDatePicker({ value, onChange, error, label }: { value?: string, onChange: (val: string) => void, error?: string, label: string }) {
  const initialDate = value ? new Date(value) : new Date();
  const [selectedDate, setSelectedDate] = useState<{ start: Date; end: Date }>({
    start: initialDate,
    end: initialDate,
  });
  const [dateState, setDateState] = useState({
    month: initialDate.getMonth(),
    year: initialDate.getFullYear(),
  });

  const handleDateChange = useCallback(
    (range: { start: Date; end: Date }) => {
      setSelectedDate(range);
      if (range.start) {
        onChange(range.start.toISOString().split("T")[0]);
      }
    },
    [onChange]
  );

  const handleMonthChange = useCallback(
    (month: number, year: number) => setDateState({ month, year }),
    []
  );

  return (
    <DatePicker
      month={dateState.month}
      year={dateState.year}
      onChange={handleDateChange}
      onMonthChange={handleMonthChange}
      selected={selectedDate}
    />
  );
}

export function DynamicConditionInput({
  appliesTo,
  condition,
  value = "",
  onChange,
  error,
}: DynamicConditionInputProps) {
  const handleChange = (newValue: string) => {
    onChange?.(newValue);
  };

  const handleProductChange = (product: any) => {
    if (product) {
      // Extract the product ID from the GraphQL ID format
      const productId = product.id.split('/').pop();
      onChange?.(productId);
    } else {
      onChange?.("");
    }
  };

  const renderOrderInput = () => {
    switch (condition) {
      case "total_greater_than":
      case "total_less_than":
        return (
          <TextField
            label="Amount"
            type="number"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="0.00"
            prefix="$"
          />
        );

      case "discount_used":
        return (
          <TextField
            label="Discount Code"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="Enter discount code"
          />
        );

      case "contains_item":
        return (
          <ProductPickerField
            label="Select Product"
            onChange={handleProductChange}
            error={error}
            helpText="Select a specific product that must be in the order"
          />
        );

      case "shipping_method":
        return (
          <Select
            label="Shipping Method"
            name="conditionValue"
            options={[
              { label: "Select shipping method", value: "" },
              { label: "Standard", value: "Standard" },
              { label: "Express", value: "Express" },
              { label: "Pickup", value: "Pickup" },
            ]}
            value={value}
            onChange={handleChange}
            error={error}
          />
        );

      case "order_tag":
        return (
          <TextField
            label="Order Tag"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="Enter order tag"
          />
        );

      case "is_first_order":
        return (
          <Select
            label="Is First Order"
            name="conditionValue"
            options={[
              { label: "Select option", value: "" },
              { label: "Yes", value: "Yes" },
              { label: "No", value: "No" },
            ]}
            value={value}
            onChange={handleChange}
            error={error}
          />
        );

      case "fulfillment_status":
        return (
          <Select
            label="Fulfillment Status"
            name="conditionValue"
            options={[
              { label: "Select status", value: "" },
              { label: "Unfulfilled", value: "Unfulfilled" },
              { label: "Partial", value: "Partial" },
              { label: "Fulfilled", value: "Fulfilled" },
            ]}
            value={value}
            onChange={handleChange}
            error={error}
          />
        );

      default:
        return (
          <TextField
            label="Value"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="Enter condition value"
          />
        );
    }
  };

  const renderCustomerInput = () => {
    switch (condition) {
      case "total_spent":
        return (
          <TextField
            label="Total Spent"
            type="number"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="0.00"
            prefix="$"
          />
        );

      case "orders_placed":
        return (
          <TextField
            label="Number of Orders"
            type="number"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="0"
          />
        );

      case "has_email":
        return (
          <Select
            label="Has Email"
            name="conditionValue"
            options={[
              { label: "Select option", value: "" },
              { label: "Yes", value: "Yes" },
              { label: "No", value: "No" },
            ]}
            value={value}
            onChange={handleChange}
            error={error}
          />
        );

      case "customer_tagged":
        return (
          <TextField
            label="Customer Tag"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="Enter customer tag"
          />
        );

      case "accepts_marketing":
        return (
          <Select
            label="Accepts Marketing"
            name="conditionValue"
            options={[
              { label: "Select option", value: "" },
              { label: "Yes", value: "Yes" },
              { label: "No", value: "No" },
            ]}
            value={value}
            onChange={handleChange}
            error={error}
          />
        );

      case "customer_location":
        return (
          <Select
            label="Customer Location"
            name="conditionValue"
            options={[
              { label: "Select country", value: "" },
              { label: "United States", value: "US" },
              { label: "Canada", value: "CA" },
              { label: "United Kingdom", value: "GB" },
              { label: "Australia", value: "AU" },
              { label: "Germany", value: "DE" },
              { label: "France", value: "FR" },
              { label: "Japan", value: "JP" },
              { label: "Other", value: "Other" },
            ]}
            value={value}
            onChange={handleChange}
            error={error}
          />
        );

      case "created_before":
        return (
          <SingleDatePicker
            label="Created Before"
            value={value}
            onChange={handleChange}
            error={error}
          />
        );

      default:
        return (
          <TextField
            label="Value"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="Enter condition value"
          />
        );
    }
  };

  const renderProductInput = () => {
    switch (condition) {
      case "title_contains":
        return (
          <ProductPickerField
            label="Select Product"
            onChange={handleProductChange}
            error={error}
            helpText="Select a specific product to check if title contains this product's title"
          />
        );

      case "product_is":
        return (
          <ProductPickerField
            label="Select Product"
            onChange={handleProductChange}
            error={error}
            helpText="Select a specific product to match exactly"
          />
        );

      case "vendor_is":
        return (
          <TextField
            label="Vendor"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="Enter vendor name"
          />
        );

      case "price_over":
        return (
          <TextField
            label="Price"
            type="number"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="0.00"
            prefix="$"
          />
        );

      case "product_type":
        return (
          <TextField
            label="Product Type"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="Enter product type"
          />
        );

      case "inventory_low":
        return (
          <TextField
            label="Inventory Threshold"
            type="number"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="0"
          />
        );

      case "product_tag":
        return (
          <TextField
            label="Product Tag"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="Enter product tag"
          />
        );

      case "sku_starts_with":
        return (
          <TextField
            label="SKU Prefix"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="Enter SKU prefix"
          />
        );

      case "published_before":
        return (
          <SingleDatePicker
            label="Published Before"
            value={value}
            onChange={handleChange}
            error={error}
          />
        );

      default:
        return (
          <TextField
            label="Value"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="Enter condition value"
          />
        );
    }
  };

  const renderInput = () => {
    switch (appliesTo) {
      case "Order":
        return renderOrderInput();
      case "Customer":
        return renderCustomerInput();
      case "Product":
        return renderProductInput();
      default:
        return (
          <TextField
            label="Value"
            name="conditionValue"
            value={value}
            onChange={handleChange}
            error={error}
            placeholder="Enter condition value"
          />
        );
    }
  };

  return (
    <FormLayout>
      {renderInput()}
      {!condition && (
        <Text as="p" variant="bodySm" tone="subdued">
          Select a condition to see the appropriate input field
        </Text>
      )}
    </FormLayout>
  );
} 