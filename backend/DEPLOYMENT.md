# Deploying Claerdex Backend to Vercel

This guide walks you through deploying your FastAPI backend as serverless functions on Vercel.

## Prerequisites

- Vercel Pro account (required for Vercel KV)
- GitHub repository with your code
- Vercel CLI (optional): `npm i -g vercel`

## File Structure

The backend has been restructured for Vercel deployment:

```
backend/
├── api/
│   └── index.py           # FastAPI app (serverless entry point)
├── aeternity_client.py    # Blockchain interaction layer
├── state.py               # Vercel KV storage adapter
├── models.py              # Pydantic data models
├── requirements.txt       # Python dependencies
├── vercel.json           # Vercel configuration
└── .vercelignore         # Files to exclude from deployment
```

## Deployment Steps

### 1. Set Up Vercel KV Database

**This is CRITICAL - do this first:**

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Navigate to the **Storage** tab
3. Click **Create Database** → Select **KV** (Redis)
4. Name it something like `claerdex-kv`
5. Click **Create**
6. **Connect it to your project** (you can do this during or after project creation)

Vercel will automatically inject these environment variables:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_URL`

### 2. Deploy to Vercel

**Option A: Via Vercel Dashboard (Recommended)**

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel will auto-detect the `vercel.json` configuration
4. Set the **Root Directory** to `backend` (if your repo has both frontend and backend)
5. Go to **Storage** tab and connect the KV database you created in step 1
6. Click **Deploy**

**Option B: Via Vercel CLI**

```bash
cd backend
vercel
# Follow the prompts
# After deployment, link the KV database in the dashboard
```

### 3. Verify Deployment

Once deployed, test your endpoints:

```bash
# Health check
curl https://your-project.vercel.app/

# Get prices
curl https://your-project.vercel.app/api/prices

# Get account (will create a new one)
curl https://your-project.vercel.app/api/account/ak_test123
```

### 4. Environment Variables (Optional)

If you need to add additional environment variables (like API keys):

1. Go to **Project Settings** → **Environment Variables**
2. Add your variables (e.g., `AE_SECRET_KEY`, `AETERNITY_NODE_URL`)
3. Redeploy for changes to take effect

## API Endpoints

When deployed to Vercel, all endpoints are automatically prefixed with `/api`:

- `GET /api` - Health check
- `GET /api/prices` - Get asset prices
- `GET /api/account/{address}` - Get user account
- `POST /api/positions/open` - Open position
- `POST /api/positions/close/{id}` - Close position

**Note:** In `api/index.py`, routes are defined WITHOUT the `/api` prefix (e.g., `@app.get("/prices")`), because Vercel adds it automatically.

## Important Notes

### State Management
- **Production**: Uses Vercel KV (Redis) for persistent storage
- **Local Dev**: Falls back to in-memory dictionary (won't persist between restarts)

### Serverless Limitations
- Each request runs in a fresh function instance
- No persistent memory between requests
- All state MUST be saved to Vercel KV
- 10-second execution timeout (hobby) / 60s (pro)

### CORS
The backend allows all origins (`*`) for development. For production, update `api/index.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://your-frontend-domain.com"],  # Specify your frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Troubleshooting

### "vercel_kv module not found"
- Make sure Vercel KV is connected to your project
- Check that `vercel-kv` is in `requirements.txt`
- Redeploy the project

### "Data not persisting"
- Verify Vercel KV is connected in the Storage tab
- Check environment variables are set (`KV_REST_API_URL`, `KV_REST_API_TOKEN`)
- Look at function logs in Vercel dashboard

### "500 Internal Server Error"
- Check Vercel function logs: Dashboard → Your Project → Functions
- Common issues:
  - Missing environment variables
  - Import errors (check all files are in the deployment)
  - KV connection issues

## Local Development

To test locally with the same structure:

```bash
cd backend
pip install -r requirements.txt
uvicorn api.index:app --reload --port 8000
```

Note: This will use in-memory storage (not KV) unless you set up local KV credentials.

## Next Steps After Deployment

1. ✅ Update frontend to use your Vercel backend URL
2. ✅ Implement real Aeternity oracle integration in `aeternity_client.py`
3. ✅ Add authentication/security if needed
4. ✅ Set up monitoring and error tracking
5. ✅ Configure custom domain (optional)

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Vercel KV Docs](https://vercel.com/docs/storage/vercel-kv)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
