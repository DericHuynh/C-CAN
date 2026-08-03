
#!/bin/sh
# Temporary diagnostic: reproduce the dev-server wedge and capture evidence.
set -u

pkill -f "agent-native.js dev" 2>/dev/null
sleep 2
nohup pnpm exec agent-native dev > /tmp/c-can-dev.log 2>&1 &
echo "dev server restarted, pid $!"
sleep 8

VPID=$(pgrep -f "vite/bin/vite.js" | head -1)
echo "vite pid: $VPID"
kill -USR1 "$VPID" 2>/dev/null
sleep 1.5
WS=$(curl -s -m 5 http://127.0.0.1:9229/json | grep -oE '"webSocketDebuggerUrl": "[^"]*"' | head -1 | sed 's/.*"ws:/ws:/; s/"$//')
echo "inspector ws: $WS"

# Start a background CPU profile that samples during the burst.
node scripts/tmp-cpu-profile.mjs "$WS" 20000 > /tmp/c-can-profile.txt 2>&1 &
PROF_PID=$!

# Warm the landing (like the user's browser does).
curl -s -m 30 -o /dev/null http://localhost:8080/
echo "landing warm: $?"

echo "firing 40 concurrent cold SSRs to the editor route..."
for i in $(seq 1 40); do
  curl -s -m 30 -o /dev/null -w "%{http_code} " "http://localhost:8080/projects/af8f4b8d-b881-4534-b845-d68314ebc80d" &
done
wait
echo
echo "burst done"

sleep 3
echo "== follow-up /projects =="
curl -s -m 8 -o /dev/null -w "code=%{http_code} total=%{time_total}s\n" http://localhost:8080/projects
echo "== cpu =="
ps -eo pid,pcpu,comm --sort=-pcpu | head -3

wait "$PROF_PID" 2>/dev/null
echo "== profile summary =="
cat /tmp/c-can-profile.txt
