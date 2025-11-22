# Debugging Guide - No Data Showing

## Quick Checks

1. **Is the server running?**
   ```bash
   npm run server
   ```
   Should see: "Server running on port 5001"

2. **Is MongoDB running?**
   ```bash
   # Check if MongoDB is running
   mongod --version
   # Or start it:
   mongod --dbpath ~/data/db
   ```

3. **Is the database seeded?**
   ```bash
   npm run seed
   ```
   Should see: "Inserted 77 nodes" and "Inserted 88 edges"

4. **Check browser console**
   - Open DevTools (F12)
   - Look for:
     - "Graph data received:" - shows what data was fetched
     - "Nodes count:" - should show 77
     - "Edges count:" - should show 88
     - Any error messages

5. **Check Network tab**
   - Open DevTools → Network tab
   - Look for `/api/graph` request
   - Check if it returns 200 status
   - Check the response - should have `nodes` and `edges` arrays

6. **Check workspace**
   - Make sure workspace is set to "default" in sidebar
   - Try typing "default" in the workspace field

## Common Issues

### Issue: Server not running
**Solution**: Run `npm run server` in a terminal

### Issue: MongoDB not running
**Solution**: 
```bash
mongod --dbpath ~/data/db
# Or on macOS:
brew services start mongodb-community
```

### Issue: Database not seeded
**Solution**: Run `npm run seed`

### Issue: Wrong workspace
**Solution**: Set workspace to "default" in sidebar

### Issue: API returning empty arrays
**Check**: Open browser console, look for "Graph data received" log
- If nodes/edges are empty, check MongoDB connection
- If error, check server logs

## Test API Directly

```bash
# Test if API is working
curl http://localhost:5001/api/graph?workspace=default

# Should return JSON with nodes and edges arrays
```

