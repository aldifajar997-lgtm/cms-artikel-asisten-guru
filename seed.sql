INSERT OR IGNORE INTO roles (id, name, description) VALUES 
('role-super-admin', 'Super Admin', 'Memiliki akses penuh ke seluruh sistem'),
('role-admin', 'Admin', 'Dapat mengelola pengguna dan konten'),
('role-editor', 'Editor', 'Dapat mengedit dan mempublikasikan semua konten'),
('role-writer', 'Writer', 'Hanya dapat menulis dan mengedit kontennya sendiri');

-- INSERT PERMISSIONS
INSERT OR IGNORE INTO permissions (id, name) VALUES 
('perm-create-post', 'create_post'),
('perm-edit-post', 'edit_post'),
('perm-delete-post', 'delete_post'),
('perm-upload-media', 'upload_media'),
('perm-delete-media', 'delete_media'),
('perm-manage-taxonomy', 'manage_taxonomy'),
('perm-manage-settings', 'manage_settings'),
('perm-view-dashboard', 'view_dashboard');

-- MAP PERMISSIONS TO ROLES
-- Admin (Can manage content, taxonomy, media, dashboard, settings)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-admin', 'perm-create-post'),
('role-admin', 'perm-edit-post'),
('role-admin', 'perm-delete-post'),
('role-admin', 'perm-upload-media'),
('role-admin', 'perm-delete-media'),
('role-admin', 'perm-manage-taxonomy'),
('role-admin', 'perm-manage-settings'),
('role-admin', 'perm-view-dashboard');

-- Editor (Can manage content and media)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-editor', 'perm-create-post'),
('role-editor', 'perm-edit-post'),
('role-editor', 'perm-delete-post'),
('role-editor', 'perm-upload-media'),
('role-editor', 'perm-delete-media'),
('role-editor', 'perm-manage-taxonomy'),
('role-editor', 'perm-view-dashboard');

-- Writer (Can write and edit own content, upload media, view dashboard)
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
('role-writer', 'perm-create-post'),
('role-writer', 'perm-edit-post'),
('role-writer', 'perm-upload-media'),
('role-writer', 'perm-view-dashboard');

