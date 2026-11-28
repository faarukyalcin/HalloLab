-- Preserve the existing sole administrator as founder. Do not guess among multiple admins.
INSERT OR IGNORE INTO app_settings(key,value,updated_at)
SELECT 'founder_user_id',id,created_at FROM users
WHERE role='admin' AND (SELECT COUNT(*) FROM users WHERE role='admin')=1;
