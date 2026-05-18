#!/bin/bash
# Backup do banco PostgreSQL
# Uso: ./scripts/backup-db.sh
# Cron diário: 0 3 * * * /caminho/para/scripts/backup-db.sh
#
# Variáveis de ambiente necessárias (ou editar abaixo):
#   DB_NAME, DB_USER, DB_HOST, BACKUP_DIR, BACKUP_RETENTION_DAYS
#   Opcional: S3_BUCKET (para upload ao S3/R2)

set -euo pipefail

DB_NAME="${DB_NAME:-derlei_prod}"
DB_USER="${DB_USER:-derlei}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/derlei}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
DATE=$(date +"%Y-%m-%d_%H-%M-%S")
FILENAME="backup_${DB_NAME}_${DATE}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

mkdir -p "$BACKUP_DIR"

echo "[backup] Iniciando: ${DB_NAME} → ${FILEPATH}"

pg_dump \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USER" \
  -F p \
  "$DB_NAME" \
  | gzip > "$FILEPATH"

echo "[backup] Arquivo gerado: $(du -h "$FILEPATH" | cut -f1)"

# Upload para S3/R2 (opcional — configure S3_BUCKET no .env)
if [ -n "${S3_BUCKET:-}" ]; then
  aws s3 cp "$FILEPATH" "s3://${S3_BUCKET}/backups/${FILENAME}"
  echo "[backup] Upload para s3://${S3_BUCKET}/backups/${FILENAME} concluído."
fi

# Remove backups antigos
find "$BACKUP_DIR" -name "backup_${DB_NAME}_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
echo "[backup] Backups com mais de ${RETENTION_DAYS} dias removidos."

echo "[backup] Concluído: ${DATE}"
