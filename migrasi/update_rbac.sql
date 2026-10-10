INSERT OR IGNORE INTO permissions (id, name) VALUES ('perm_edit_any_post', 'edit_any_post');
INSERT OR IGNORE INTO permissions (id, name) VALUES ('perm_create_product', 'create_product');
INSERT OR IGNORE INTO permissions (id, name) VALUES ('perm_edit_product', 'edit_product');
INSERT OR IGNORE INTO permissions (id, name) VALUES ('perm_delete_product', 'delete_product');
INSERT OR IGNORE INTO permissions (id, name) VALUES ('perm_edit_any_product', 'edit_any_product');

-- Asumsi id roles Admin dan Editor ada (kita perlu lihat ID-nya dulu, atau bisa di-join)
-- Lebih aman pakai subquery
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Admin' AND p.name IN ('edit_any_post', 'create_product', 'edit_product', 'delete_product', 'edit_any_product');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Editor' AND p.name IN ('edit_any_post', 'create_product', 'edit_product', 'delete_product', 'edit_any_product');

-- Tampilkan current roles & permissions
SELECT r.name as RoleName, p.name as PermissionName 
FROM roles r 
LEFT JOIN role_permissions rp ON r.id = rp.role_id 
LEFT JOIN permissions p ON rp.permission_id = p.id;
