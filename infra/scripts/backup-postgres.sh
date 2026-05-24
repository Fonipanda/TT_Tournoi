#!/usr/bin/env bash
# =============================================================================
# Backup PostgreSQL → Object Storage OVH (S3-compatible)
# =============================================================================
# Cron : 0 3 * * * tt /opt/tt-tournoi/backup-postgres.sh
# Variables d'env requises :
#   S3_BACKUP_BUCKET, S3_BACKUP_ENDPOINT, S3_BACKUP_ACCESS_KEY, S3_BACKUP_SECRET_KEY
# =============================================================================

set -euo pipefail

DATE=$(date +%Y%m%d-%H%M%S)
TMPFILE="/tmp/tt_tournoi_${DATE}.sql.gz"

# Charger les variables (à adapter selon ton setup)
if [ -f /etc/tt-tournoi/backup.env ]; then
  # shellcheck disable=SC1091
  source /etc/tt-tournoi/backup.env
fi

: "${S3_BACKUP_BUCKET:?S3_BACKUP_BUCKET requis}"
: "${S3_BACKUP_ENDPOINT:?S3_BACKUP_ENDPOINT requis}"

# Dump
echo "[backup] dump → ${TMPFILE}"
docker exec tt-postgres pg_dump -U tt tt_tournoi | gzip > "${TMPFILE}"

# Upload S3 (aws-cli requis)
echo "[backup] upload → s3://${S3_BACKUP_BUCKET}/"
AWS_ACCESS_KEY_ID="${S3_BACKUP_ACCESS_KEY}" \
AWS_SECRET_ACCESS_KEY="${S3_BACKUP_SECRET_KEY}" \
  aws s3 cp "${TMPFILE}" "s3://${S3_BACKUP_BUCKET}/" \
  --endpoint-url="${S3_BACKUP_ENDPOINT}"

# Rotation locale (30 jours)
find /tmp/tt_tournoi_*.sql.gz -mtime +30 -delete 2>/dev/null || true

echo "[backup] ✅ done"
