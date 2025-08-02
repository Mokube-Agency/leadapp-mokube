#!/bin/bash

# ====================================================
# Leadapp – Automatische Test voor create-event
# ====================================================
#
# Doel: Test de create-event functie na elke deploy
#

echo "🏃‍♂️ Running create-event curl test..."

# Test de create-event endpoint
curl -i \
  -X POST https://ipjrhuijvgchbezcjhsk.supabase.co/functions/v1/create-event \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlwanJodWlqdmdjaGJlemNqaHNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwMjg2ODIsImV4cCI6MjA2ODYwNDY4Mn0.6ixbyuGbnB0mGp2HEWEwPcQt8G_6yWsP-muuJ9Hk_rc" \
  -d '{
        "grant_id": "test-grant-id",
        "calendar_id": "test-calendar-id",
        "title": "Test afspraak",
        "date": "2025-08-15",
        "start_time": "14:00",
        "end_time": "15:00"
      }'

echo
echo "✅ Test completed"