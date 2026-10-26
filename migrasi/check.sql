SELECT u.id, u.email, u.name, u.is_active, u.seller_status, GROUP_CONCAT(r.name, ', ') as roles
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
GROUP BY u.id;
