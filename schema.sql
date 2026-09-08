-- TABEL RBAC (Role-Based Access Control)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    password_hash TEXT NOT NULL, 
    is_active INTEGER DEFAULT 1,
    bio TEXT,
    portfolio_url TEXT,
    target_min_words INTEGER,
    target_keyword_density REAL,
    preferred_tone TEXT,
    main_language TEXT,
    monthly_article_goal INTEGER,
    monthly_word_goal INTEGER,
    primary_niche TEXT,
    social_linkedin TEXT,
    social_twitter TEXT,
    social_instagram TEXT,
    social_facebook TEXT,
    social_tiktok TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL, 
    description TEXT
);

CREATE TABLE permissions (
    id TEXT PRIMARY KEY,
    name TEXT UNIQUE NOT NULL 
);

CREATE TABLE role_permissions (
    role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
    permission_id TEXT REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE user_roles (
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    role_id TEXT REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- TABEL MANAJEMEN SESI (SECURITY PATCH)
CREATE TABLE refresh_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    user_agent TEXT,
    ip_address TEXT,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TABEL CMS, KATEGORI, TAGS & SEO
CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    target_keywords TEXT,
    color TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE tags (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE posts (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL, 
    title TEXT NOT NULL,
    excerpt TEXT,
    content TEXT,
    featured_image TEXT,
    featured_image_alt TEXT,
    featured_image_caption TEXT,
    meta_title TEXT, 
    meta_description TEXT, 
    focus_keyword TEXT,
    secondary_keywords TEXT,
    seo_score INTEGER,
    word_count INTEGER,
    reading_time_minutes INTEGER,
    view_count INTEGER DEFAULT 0,
    author_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'draft',
    published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE post_tags (
    post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
    tag_id TEXT REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE media (
    id TEXT PRIMARY KEY,
    r2_key TEXT UNIQUE NOT NULL, 
    file_name TEXT,
    alt_text TEXT,
    mime_type TEXT,
    size_bytes INTEGER,
    width INTEGER,
    height INTEGER,
    uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- TABEL RESET PASSWORD
CREATE TABLE password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    token TEXT UNIQUE NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- PENGATURAN GLOBAL / SETTINGS
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- INDEXES UNTUK PERFORMA DAN ANTI-DOS
CREATE INDEX idx_posts_status_date ON posts(status, published_at DESC);
CREATE INDEX idx_posts_status_updated ON posts(status, updated_at DESC);
CREATE INDEX idx_posts_status_views ON posts(status, view_count DESC);
CREATE INDEX idx_posts_status_category ON posts(status, category_id, published_at DESC);

-- FULL TEXT SEARCH (FTS5) UNTUK POSTS
CREATE VIRTUAL TABLE posts_search USING fts5(id UNINDEXED, title, content, excerpt);

CREATE TRIGGER posts_search_insert AFTER INSERT ON posts BEGIN
  INSERT INTO posts_search(id, title, content, excerpt) VALUES (new.id, new.title, new.content, new.excerpt);
END;

CREATE TRIGGER posts_search_delete AFTER DELETE ON posts BEGIN
  DELETE FROM posts_search WHERE id = old.id;
END;

CREATE TRIGGER posts_search_update AFTER UPDATE ON posts BEGIN
  UPDATE posts_search SET title = new.title, content = new.content, excerpt = new.excerpt WHERE id = new.id;
END;

