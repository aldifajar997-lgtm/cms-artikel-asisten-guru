INSERT OR IGNORE INTO permissions (id, name) VALUES ('perm_delete_any_media', 'delete_any_media');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Admin' AND p.name = 'delete_any_media';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Editor' AND p.name = 'delete_any_media';
