#!/bin/bash
# T23: akun database terpisah untuk bun-api dan php-api dengan hak minimum.
# Dijalankan oleh entrypoint image mysql (docker-entrypoint-initdb.d) setelah
# 01_schema.sql dan 02_seed.sql, hanya saat volume data masih kosong.
# Tidak ada akun aplikasi yang memiliki CREATE, DROP, ALTER, atau GRANT.
# Catatan: file ini sengaja TIDAK executable agar di-source oleh entrypoint
# (fungsi docker_process_sql hanya tersedia dengan cara itu). Karena di-source,
# jangan memakai `set -u` yang akan memengaruhi sisa entrypoint.

for var in MYSQL_DATABASE BUN_DB_USER BUN_DB_PASSWORD PHP_DB_USER PHP_DB_PASSWORD; do
  if [ -z "${!var:-}" ]; then
    echo "[03_app_users] $var wajib diisi" >&2
    exit 1
  fi
done

# Nilai disisipkan ke SQL, jadi batasi karakternya agar tidak bisa keluar dari literal.
for var in BUN_DB_USER PHP_DB_USER; do
  if ! [[ "${!var}" =~ ^[A-Za-z0-9_]{1,32}$ ]]; then
    echo "[03_app_users] $var hanya boleh huruf, angka, atau _ (maks. 32)" >&2
    exit 1
  fi
done
for var in BUN_DB_PASSWORD PHP_DB_PASSWORD; do
  if ! [[ "${!var}" =~ ^[A-Za-z0-9_.~+/=-]{16,128}$ ]]; then
    echo "[03_app_users] $var minimal 16 karakter dan hanya boleh [A-Za-z0-9_.~+/=-]; gunakan openssl rand -hex 24" >&2
    exit 1
  fi
done
if [ "$BUN_DB_USER" = "$PHP_DB_USER" ]; then
  echo "[03_app_users] BUN_DB_USER dan PHP_DB_USER harus berbeda" >&2
  exit 1
fi
if ! [[ "$MYSQL_DATABASE" =~ ^[A-Za-z0-9_]{1,64}$ ]]; then
  echo "[03_app_users] MYSQL_DATABASE tidak valid" >&2
  exit 1
fi

DB="\`${MYSQL_DATABASE}\`"
BUN="'${BUN_DB_USER}'@'%'"
PHP="'${PHP_DB_USER}'@'%'"

docker_process_sql --database=mysql <<-EOSQL
	CREATE USER IF NOT EXISTS ${BUN} IDENTIFIED BY '${BUN_DB_PASSWORD}';
	CREATE USER IF NOT EXISTS ${PHP} IDENTIFIED BY '${PHP_DB_PASSWORD}';

	-- bun-api (gateway): sesi, pasien, kunjungan, tarif, tagihan, pembayaran, staf.
	GRANT SELECT                 ON ${DB}.clinics           TO ${BUN};
	GRANT SELECT, INSERT         ON ${DB}.users             TO ${BUN};
	GRANT SELECT, INSERT, DELETE ON ${DB}.auth_sessions     TO ${BUN};
	GRANT SELECT, INSERT, UPDATE, DELETE ON ${DB}.login_attempts TO ${BUN};
	GRANT SELECT, INSERT         ON ${DB}.patients          TO ${BUN};
	GRANT SELECT, INSERT         ON ${DB}.visits            TO ${BUN};
	GRANT SELECT, UPDATE         ON ${DB}.services          TO ${BUN};
	GRANT SELECT, UPDATE         ON ${DB}.invoices          TO ${BUN};
	GRANT SELECT                 ON ${DB}.invoice_items     TO ${BUN};
	GRANT SELECT, INSERT         ON ${DB}.payments          TO ${BUN};
	GRANT SELECT, INSERT         ON ${DB}.payment_requests  TO ${BUN};
	GRANT SELECT                 ON ${DB}.claims            TO ${BUN};
	GRANT SELECT, INSERT, UPDATE ON ${DB}.staff_invitations TO ${BUN};
	GRANT INSERT                 ON ${DB}.audit_log         TO ${BUN};

	-- php-api (legacy): laporan, klaim, lampiran.
	GRANT SELECT                 ON ${DB}.clinics           TO ${PHP};
	GRANT SELECT                 ON ${DB}.patients          TO ${PHP};
	GRANT SELECT                 ON ${DB}.visits            TO ${PHP};
	GRANT SELECT, UPDATE         ON ${DB}.invoices          TO ${PHP};
	GRANT SELECT, INSERT         ON ${DB}.payments          TO ${PHP};
	GRANT SELECT, UPDATE         ON ${DB}.claims            TO ${PHP};
	GRANT SELECT                 ON ${DB}.claim_attachments TO ${PHP};
	GRANT INSERT                 ON ${DB}.audit_log         TO ${PHP};

	FLUSH PRIVILEGES;
EOSQL

echo "[03_app_users] akun ${BUN_DB_USER} dan ${PHP_DB_USER} dibuat dengan hak minimum"
