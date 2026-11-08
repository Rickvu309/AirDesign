import {createHash} from "node:crypto"

export const historySchemaConstraintsSql="SELECT conname::text COLLATE \"C\" AS conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype <> 'n' UNION ALL SELECT (table_name || '_' || column_name || '_not_null') COLLATE \"C\" AS conname, 'NOT NULL ' || quote_ident(column_name) AS definition FROM information_schema.columns WHERE table_schema='public' AND is_nullable='NO' ORDER BY conname"

export function historySchemaFingerprint(value:unknown){
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}
