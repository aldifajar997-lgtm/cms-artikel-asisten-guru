INSERT OR IGNORE INTO roles (id, name) VALUES ('role-seller', 'Seller');

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'Seller' AND p.name IN (
  'create_product', 
  'edit_product', 
  'delete_product', 
  'view_dashboard', 
  'upload_media', 
  'delete_media'
);
