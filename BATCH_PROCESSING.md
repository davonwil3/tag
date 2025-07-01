# Batch Processing System

This document describes the new batch processing system for tagging orders, products, and customers in bulk.

## Overview

The batch processing system allows you to apply your tagging rules to existing orders, products, and customers in your Shopify store. It's designed to be Vercel-compatible and can handle large datasets efficiently.

## Features

- **Multi-Entity Support**: Process orders, products, and customers separately
- **Progress Tracking**: Real-time progress updates with cursor-based pagination
- **Vercel Compatibility**: Uses cron jobs to continue processing across function timeouts
- **Resumable**: Can resume from where it left off if interrupted
- **Rate Limited**: Built-in delays to respect Shopify API limits

## How It Works

### 1. Database Schema

The system uses the `merchantSettings` table with new fields for each entity type:

```sql
-- Per-entity batch progress and cursor fields
orderBatchCursor       String?
orderBatchProgress     Json?
productBatchCursor     String?
productBatchProgress   Json?
customerBatchCursor    String?
customerBatchProgress  Json?
```

### 2. API Endpoints

#### Start Batch Processing
- `POST /api/batch/{entityType}` - Start processing orders, products, or customers
- Entity types: `order`, `product`, `customer`

#### Check Status
- `GET /api/batch/{entityType}` - Get current processing status and progress

#### Continue Processing (Cron)
- `POST /api/batch/{entityType}/continue` - Continue processing (called by Vercel cron)

### 3. Vercel Cron Jobs

The system uses Vercel cron jobs to continue processing every 5 minutes:

```json
{
  "crons": [
    {
      "path": "/api/batch/order/continue",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/batch/product/continue", 
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/batch/customer/continue",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## Usage

### Starting Batch Processing

1. Navigate to the Dashboard
2. In the "Batch Processing" section, click the button for the entity type you want to process:
   - **Process Orders** - Apply rules to existing orders
   - **Process Products** - Apply rules to existing products  
   - **Process Customers** - Apply rules to existing customers

### Monitoring Progress

- Progress bars show real-time processing status
- Processing counts are displayed for each entity type
- Completed batches show a "Completed" badge
- You can re-process any entity type after completion

### Processing Logic

1. **Fetch Entities**: Retrieves entities from Shopify API with pagination
2. **Apply Rules**: Evaluates each entity against your tagging rules
3. **Update Tags**: Applies tags to entities that match rule conditions
4. **Track Progress**: Updates database with progress and cursor information
5. **Continue**: Vercel cron jobs continue processing until complete

## Technical Details

### Batch Size
- Default: 25 entities per batch
- Configurable in the `processBatch` function

### Rate Limiting
- 500ms delay between entity updates
- Respects Shopify API rate limits

### Error Handling
- Failed entity updates are logged but don't stop processing
- Processing continues from the last successful cursor position

### Data Storage
- Progress is stored as JSON in the database
- Cursors enable resumable processing
- Tag activity is tracked in the `tagActivity` table

## Migration from Legacy System

The new system is backward compatible with the legacy "Tag Past Orders" functionality. The legacy system is still available but marked as "Legacy" in the UI.

### Key Differences

| Feature | Legacy | New System |
|---------|--------|------------|
| Entity Types | Orders only | Orders, Products, Customers |
| Progress Tracking | Simple percentage | Detailed progress with counts |
| Resumability | Limited | Full cursor-based resumption |
| Vercel Compatibility | No | Yes, with cron jobs |
| UI | Single button | Per-entity controls |

## Troubleshooting

### Processing Stuck
- Check Vercel function logs for errors
- Verify cron jobs are running (check Vercel dashboard)
- Manual restart: delete progress from database and restart

### Performance Issues
- Reduce batch size in `processBatch` function
- Increase delays between API calls
- Monitor Shopify API rate limits

### Data Consistency
- Tag activity is logged for audit trails
- Failed updates are logged but don't affect other entities
- Progress is saved after each batch completion

## Future Enhancements

- Parallel processing for multiple shops
- Configurable batch sizes per entity type
- Advanced filtering options
- Processing schedules and automation
- Detailed analytics and reporting 