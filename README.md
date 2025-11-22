# WorldGraph v3 — The Graph of Everything

A MERN stack application for visualizing knowledge graphs with interactive filtering and exploration capabilities.

## Features

- 🌐 Interactive graph visualization using vis-network
- 🔍 Real-time search and filtering
- 📊 Dynamic entity types (no hardcoded limits - supports any entity type)
- 📅 Flexible timeline filtering (min/max year, no arbitrary constraints)
- 📝 Entity inspector with detailed information, tags, and metadata
- 🗄️ MongoDB database with proper indexing for performance
- 🔄 RESTful API for CRUD operations
- 🏢 Workspace/domain separation for multi-domain support
- 🏷️ Tag-based categorization
- 📦 Flexible metadata system (custom fields per node/edge)
- ⚖️ Edge weights for relationship strength
- 📈 Graph statistics and analytics
- 🔗 Path finding algorithm (shortest path between nodes)
- 📥 Import/Export functionality (JSON, CSV)
- 📄 Pagination support for large datasets
- 💡 **Insight Generation Engine** - Automatically discover unexpected connections, key insights, knowledge gaps, and patterns

## Tech Stack

- **Frontend**: React 18, Vite, vis-network
- **Backend**: Node.js, Express
- **Database**: MongoDB, Mongoose
- **API**: RESTful endpoints

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation with `mongod --dbpath ~/data/db` or MongoDB Atlas)
- npm or yarn

## Installation

1. **Clone the repository** (if applicable) or navigate to the project directory:
   ```bash
   cd worldGraph
   ```

2. **Install dependencies for both server and client**:
   ```bash
   npm run install-all
   ```
   
   Or install separately:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

3. **Set up environment variables**:
   ```bash
   cd server
   cp env.example .env
   ```
   
   Edit `server/.env` and configure:
   ```
   PORT=5001
   MONGODB_URI=mongodb://localhost:27017/worldgraph
   NODE_ENV=development
   ```
   
   **Note:** Port 5001 is used instead of 5000 to avoid conflicts with macOS AirPlay Receiver.
   
   The default connection string `mongodb://localhost:27017/worldgraph` works for local MongoDB instances. The database name is `worldgraph`.

4. **Start MongoDB locally**:
   Make sure MongoDB is running on your system:
   ```bash
   mongod --dbpath ~/data/db
   ```
   
   Or if MongoDB is installed as a service, start it with:
   ```bash
   # macOS (Homebrew)
   brew services start mongodb-community
   
   # Linux (systemd)
   sudo systemctl start mongod
   ```
   
   The connection string `mongodb://localhost:27017/worldgraph` will connect to your local MongoDB instance regardless of the `--dbpath` you use. If using MongoDB Atlas, update the `MONGODB_URI` in `.env` with your Atlas connection string.

5. **Seed the database**:
   ```bash
   npm run seed
   ```

## Running the Application

### Development Mode

Run both server and client concurrently:
```bash
npm run dev
```

Or run them separately:

**Terminal 1 - Backend:**
```bash
npm run server
```

**Terminal 2 - Frontend:**
```bash
npm run client
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5001

## API Endpoints

### Graph
- `GET /api/graph` - Get filtered graph data
  - Query params: `search`, `types`, `minYear`, `maxYear`, `workspace`, `tags`, `page`, `limit`
- `GET /api/graph/stats` - Get graph statistics
  - Query params: `workspace`
- `GET /api/graph/path` - Find shortest path between nodes
  - Query params: `from`, `to`, `workspace`, `maxDepth`

### Nodes
- `GET /api/nodes` - Get all nodes (with optional filters and pagination)
  - Query params: `search`, `types`, `minYear`, `maxYear`, `workspace`, `tags`, `page`, `limit`
- `GET /api/nodes/:id` - Get single node
- `POST /api/nodes` - Create new node
  - Body: `{ label, group, year?, info, tags?, metadata?, workspace? }`
- `PUT /api/nodes/:id` - Update node
- `DELETE /api/nodes/:id` - Delete node

### Edges
- `GET /api/edges` - Get all edges (with pagination)
  - Query params: `workspace`, `page`, `limit`
- `GET /api/edges/filtered` - Get filtered edges
  - Query param: `nodeIds` (comma-separated)
- `GET /api/edges/:id` - Get single edge
- `POST /api/edges` - Create new edge
  - Body: `{ from, to, label, weight?, metadata?, workspace? }`
- `PUT /api/edges/:id` - Update edge
- `DELETE /api/edges/:id` - Delete edge

### Import/Export
- `POST /api/import/json` - Import nodes and edges from JSON
  - Body: `{ nodes: [...], edges: [...], workspace? }`
- `POST /api/import/csv` - Import nodes from CSV
  - Body: `{ csv: "...", workspace? }`
- `GET /api/export/json` - Export graph as JSON
  - Query params: `workspace`
- `GET /api/export/csv` - Export nodes as CSV
  - Query params: `workspace`

### Insights
- `GET /api/insights` - Get all insights for a workspace
  - Query params: `workspace`
  - Returns: Unexpected connections, key insights, knowledge gaps, influence analysis, temporal patterns
- `GET /api/insights/:type` - Get specific insight type
  - Types: `unexpected-connections`, `key-insights`, `knowledge-gaps`, `influence-analysis`, `temporal-patterns`
  - Query params: `workspace`

## Project Structure

```
worldGraph/
├── client/                 # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/      # API service functions
│   │   └── App.js
│   └── package.json
├── server/                # Express backend
│   ├── models/           # Mongoose models
│   ├── routes/           # API routes
│   ├── scripts/          # Database seed script
│   └── index.js          # Server entry point
├── package.json
└── README.md
```

## Usage

1. **View the graph**: The main view displays all entities as nodes connected by edges
2. **Workspace selection**: Choose or create a workspace to organize different domains
3. **Search**: Type in the search box to filter entities by name or description
4. **Filter by type**: Check/uncheck entity types to show/hide them (types are dynamic based on your data)
5. **Timeline**: Set min/max year to filter entities by time period
6. **Inspect entities**: Click on any node to see detailed information, tags, and metadata
7. **Import/Export**: Use the sidebar to import JSON/CSV data or export your graph
8. **Graph statistics**: View node count, edge count, and average degree in the sidebar
9. **Insights Panel**: Click the "💡 Insights" button to discover:
   - **Unexpected Connections**: Nodes connected through multiple indirect paths
   - **Key Insights**: Most connected nodes (hubs) and clusters
   - **Knowledge Gaps**: Nodes with few connections - opportunities to expand
   - **Influence Analysis**: Nodes that bridge different entity types
   - **Temporal Patterns**: Time-based patterns and long-term connections

## Development

### Adding New Entities

You can add new nodes and edges through the API, UI import, or by modifying the seed script:

```javascript
// In server/scripts/seed.js
nodes: [
  { 
    label: "New Entity", 
    group: "Idea",  // Any entity type - not limited to predefined types
    year: 2024,     // Any year - no constraints
    info: "Description",
    tags: ["tag1", "tag2"],
    metadata: { customField: "value" },
    workspace: "default"
  }
]
```

Then run `npm run seed` to update the database.

### Workspaces

Workspaces allow you to organize different domains or projects:
- Use different workspaces for different topics (e.g., "ai-research", "history", "literature")
- Each workspace has its own nodes and edges
- Change workspace in the sidebar to switch between domains

### Custom Metadata

Nodes and edges support flexible metadata:
```javascript
{
  label: "Entity",
  group: "CustomType",
  metadata: {
    "url": "https://example.com",
    "coordinates": [40.7128, -74.0060],
    "customField": "any value"
  }
}
```

### Edge Weights

Edges can have weights (0-10) to represent relationship strength:
```javascript
{
  from: "nodeId1",
  to: "nodeId2",
  label: "related",
  weight: 5  // Higher weight = stronger relationship
}
```

## License

MIT

# worldgraph
