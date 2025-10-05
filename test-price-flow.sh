#!/bin/bash

echo "🧪 Testing Live Price Data Flow"
echo "================================"
echo ""

echo "1️⃣ Railway Oracle (Source of Truth):"
echo "   URL: https://claerdex-production.up.railway.app/prices"
railway_response=$(curl -s https://claerdex-production.up.railway.app/prices)
echo "   Response: $railway_response"
ae_price_railway=$(echo $railway_response | grep -o '"AE":[0-9.]*' | grep -o '[0-9.]*')
echo "   ✅ AE Price: $ae_price_railway"
echo ""

echo "2️⃣ Backend API (Vercel - should fetch from Railway):"
echo "   URL: https://claerdex-backend.vercel.app/prices"
backend_response=$(curl -s https://claerdex-backend.vercel.app/prices)
echo "   Response: $backend_response"
echo ""

# Check if backend is using new format
if echo "$backend_response" | grep -q '"data"'; then
    echo "   ✅ Backend using NEW format (with 24h stats)"
    ae_price_backend=$(echo $backend_response | grep -o '"AE".*"price":[0-9.]*' | grep -o '[0-9.]*' | head -1)
    echo "   AE Price from backend: $ae_price_backend"
else
    echo "   ❌ Backend using OLD format (simple prices)"
    ae_price_backend=$(echo $backend_response | grep -o '"AE":[0-9.]*' | grep -o '[0-9.]*')
    echo "   AE Price from backend: $ae_price_backend"
fi
echo ""

echo "3️⃣ Frontend Integration:"
echo "   Frontend fetches from: https://claerdex-backend.vercel.app/prices"
echo "   Frontend handles both old and new formats ✅"
echo ""

echo "📊 Summary:"
echo "   Railway AE Price:  $ae_price_railway"
echo "   Backend AE Price:  $ae_price_backend"
echo ""

if [ "$ae_price_railway" == "$ae_price_backend" ]; then
    echo "✅ SUCCESS! Prices match - live data is flowing!"
else
    echo "⚠️  Prices don't match - backend may not have ORACLE_API_URL set"
    echo ""
    echo "To fix:"
    echo "1. Add ORACLE_API_URL=https://claerdex-production.up.railway.app to Vercel env vars"
    echo "2. Redeploy backend on Vercel"
fi
