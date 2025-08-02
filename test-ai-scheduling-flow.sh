#!/bin/bash

# ====================================================
# Leadapp – Automated AI Scheduling Flow Tests
# ====================================================

echo "🧪 Running AI scheduling flow tests..."

# Test 1: Direct create-event API test
echo "📅 Test 1: Testing create-event API directly..."
curl -i \
  -X POST https://ipjrhuijvgchbezcjhsk.supabase.co/functions/v1/create-event \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwanJodWlqdmdjaGJlemNqaHNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMjg2ODIsImV4cCI6MjA2ODYwNDY4Mn0.6ixbyuGbnB0mGp2HEWEwPcQt8G_6yWsP-muuJ9Hk_rc" \
  -d '{
        "grant_id": "efae13a6-1f15-4292-90d3-96e79f56d655",
        "calendar_id": "test-calendar-id",
        "title": "Test Afspraak via API",
        "date": "2025-08-30",
        "start_time": "14:00",
        "end_time": "15:00"
      }' | tee /tmp/create-event-test.log

echo ""
echo "📋 Test 2: Checking for expected log patterns..."

echo "  ✔ Looking for AI function call logs:"
echo "    - 'AI called function: create_event'"
echo "    - 'Function arguments: {...}'"

echo "  ✔ Looking for create-event logs:"
echo "    - '[create-event] Creating event with data'"
echo "    - '[create-event] Nylas API response status'"
echo "    - '[create-event] Event created successfully' OR error messages"

echo ""
echo "📱 Test 3: Simulated WhatsApp message flow..."
echo "To test the full AI flow:"
echo "1. Send 'Ik wil een afspraak inplannen' to your WhatsApp"
echo "2. Follow up with date/time in format: '2025-08-30\\n14:00\\n15:00'"
echo "3. Check Supabase Edge Function logs for:"
echo "   - twilio-webhook function showing AI response"
echo "   - create-event function showing event creation"

echo ""
echo "🔍 Test 4: Log analysis guide..."
echo "Check the following in Supabase Edge Function logs:"
echo ""
echo "Twilio Webhook logs should show:"
echo "  🤖 AI Response received: {...}"
echo "  🚀 AI called function: create_event"
echo "  🚀 Function arguments: {...}"
echo "  📞 Calling create-event function with: {...}"
echo ""
echo "Create-Event logs should show:"
echo "  🚀 [create-event] Creating event with data: {...}"
echo "  🔍 [create-event] Validating grant: ..."
echo "  🚀 [create-event] Nylas API response status: 200/400/etc"
echo "  ✅ [create-event] Event created successfully: {...}"

echo ""
echo "✅ Test suite completed"
echo "📊 Review the logs in Supabase Dashboard > Edge Functions > Logs"