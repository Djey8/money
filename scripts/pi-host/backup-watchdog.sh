#!/bin/sh
# Backup watchdog — runs hourly via /etc/cron.hourly/backup-watchdog
# Fails (and writes to the journal + a sentinel file) if no hourly backup
# has been created in the last 75 minutes.
#
# Install:
#   sudo cp scripts/pi-host/backup-watchdog.sh /etc/cron.hourly/backup-watchdog
#   sudo chmod +x /etc/cron.hourly/backup-watchdog

set -eu

HOURLY_DIR="/opt/money-app-backups/hourly"
MAX_AGE_MIN=75
SENTINEL="/var/lib/money-app-backup-watchdog.last-failure"

if [ ! -d "$HOURLY_DIR" ]; then
  logger -t backup-watchdog "FAIL: $HOURLY_DIR does not exist"
  date -Iseconds > "$SENTINEL"
  exit 1
fi

# Newest file mtime (epoch) in the hourly dir
NEWEST=$(find "$HOURLY_DIR" -maxdepth 1 -type f -name 'couchdb-backup-*.tar.gz*' \
           -printf '%T@\n' 2>/dev/null | sort -nr | head -1 | cut -d. -f1)

if [ -z "${NEWEST:-}" ]; then
  logger -t backup-watchdog "FAIL: no backup files in $HOURLY_DIR"
  date -Iseconds > "$SENTINEL"
  exit 1
fi

NOW=$(date +%s)
AGE_MIN=$(( (NOW - NEWEST) / 60 ))

if [ "$AGE_MIN" -gt "$MAX_AGE_MIN" ]; then
  logger -t backup-watchdog "FAIL: newest hourly backup is ${AGE_MIN} min old (limit ${MAX_AGE_MIN})"
  date -Iseconds > "$SENTINEL"
  exit 1
fi

# All good — clear sentinel
rm -f "$SENTINEL"
logger -t backup-watchdog "OK: newest hourly backup is ${AGE_MIN} min old"
exit 0
