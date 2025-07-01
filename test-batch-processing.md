# Batch Processing Test Checklist

## Pre-Test Setup
- [ ] Database schema updated with new batch fields
- [ ] Prisma client regenerated
- [ ] Vercel cron jobs configured in vercel.json
- [ ] App deployed to Vercel

## Test Steps

### 1. Basic Functionality
- [ ] Navigate to Dashboard
- [ ] Verify "Batch Processing" section appears
- [ ] Check that all three entity types (Orders, Products, Customers) are shown
- [ ] Verify buttons are enabled and not loading

### 2. Start Batch Processing
- [ ] Click "Process Orders" button
- [ ] Verify button shows loading state
- [ ] Check that progress bar appears
- [ ] Verify processing count updates
- [ ] Check browser console for any errors

### 3. Monitor Progress
- [ ] Wait for processing to complete or timeout
- [ ] Verify progress bar updates
- [ ] Check that processing count increases
- [ ] Verify "Completed" badge appears when done

### 4. Check Data
- [ ] Verify tags are applied in Shopify admin
- [ ] Check Recent Tag Activity section for new entries
- [ ] Verify Tag Usage Statistics are updated
- [ ] Check database for batch progress records

### 5. Test Vercel Cron (if deployed)
- [ ] Check Vercel function logs for cron job execution
- [ ] Verify continue endpoints are called
- [ ] Check that processing resumes after function timeout

## Expected Behavior

### UI
- Progress bars should show real-time updates
- Processing counts should increment
- Buttons should be disabled during processing
- "Completed" badges should appear when done

### Data
- Tags should be applied to matching entities in Shopify
- Tag activity should be recorded in database
- Tag usage statistics should be updated
- Batch progress should be saved to database

### Error Handling
- Failed entity updates should be logged but not stop processing
- Processing should continue from last successful cursor
- UI should show appropriate error messages

## Common Issues

### TypeScript Errors
- **Solution**: Run `npx prisma generate` to update types

### Database Errors
- **Solution**: Ensure schema changes are applied to database

### API Rate Limits
- **Solution**: Check Shopify API rate limit headers
- **Solution**: Increase delays in processBatch function

### Vercel Timeouts
- **Solution**: Verify cron jobs are configured correctly
- **Solution**: Check Vercel function logs for errors

## Performance Notes
- Default batch size: 25 entities
- Delay between updates: 500ms
- Cron job frequency: Every 5 minutes
- Expected processing time: Varies by entity count 