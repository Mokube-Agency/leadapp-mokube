#!/bin/bash

# ====================================================
# Leadapp – Test OAuth & Default Calendar Setup
# ====================================================

echo "🧪 Testing OAuth flow and default calendar setup..."

echo ""
echo "📋 Test 1: Check if profile has default_calendar_id after OAuth"
echo "Run this SQL query in Supabase SQL Editor to verify:"
echo ""
echo "SELECT "
echo "  user_id,"
echo "  nylas_connected," 
echo "  nylas_grant_id,"
echo "  default_calendar_id"
echo "FROM profiles"
echo "WHERE nylas_connected = true;"
echo ""

echo "📋 Test 2: Test create-event with default calendar"
echo "Replace <GRANT_ID> and <CALENDAR_ID> with actual values from your database:"
echo ""

# Get the project URL from our previous configurations
PROJECT_URL="https://ipjrhuijvgchbezcjhsk.supabase.co"

echo "curl -i -X POST ${PROJECT_URL}/functions/v1/create-event \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -H \"Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwanJodWlqdmdjaGJlemNqaHNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMjg2ODIsImV4cCI6MjA2ODYwNDY4Mn0.6ixbyuGbnB0mGp2HEWEwPcQt8G_6yWsP-muuJ9Hk_rc\" \\"
echo "  -d '{"
echo "    \"grant_id\": \"<GRANT_ID>\","
echo "    \"calendar_id\": \"<CALENDAR_ID>\","
echo "    \"title\": \"Test Afspraak\","
echo "    \"date\": \"2025-08-20\","
echo "    \"start_time\": \"10:00\","
echo "    \"end_time\": \"11:00\""
echo "  }' | jq ."

echo ""
echo "📋 Test 3: Test full WhatsApp to Calendar flow"
echo "1. Send 'Ik wil een afspraak inplannen' to your WhatsApp"
echo "2. Follow up with: '2025-08-20\\n10:00\\n11:00'"
echo "3. Check Edge Function logs for successful event creation"

echo ""
echo "🔍 Test 4: Verify OAuth redirect logs"
echo "Check these logs in Supabase Edge Functions > nylas-oauth-redirect:"
echo "  ✅ 'Token exchange successful'"
echo "  ✅ 'Selected default calendar: [calendar_id]'"
echo "  ✅ 'OAuth flow completed successfully'"

echo ""
echo "✅ Test guide completed"
echo "🔗 To test OAuth: Visit your calendar settings and re-connect"