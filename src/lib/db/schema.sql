-- Run once against the provisioned MySQL database (see DATABASE_URL in .env.example).
CREATE TABLE IF NOT EXISTS audits (
  id CHAR(36) PRIMARY KEY,
  url VARCHAR(2048) NOT NULL,
  crawled_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  page_title TEXT,
  http_status INT,
  page_text LONGTEXT,
  report JSON NOT NULL,
  crawl_batch_id CHAR(36),
  INDEX audits_url_crawled_at_idx (url(255), crawled_at DESC)
);
