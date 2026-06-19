-- Migration: 001_initial
-- Multi-tenant WhatsApp API schema

CREATE TABLE IF NOT EXISTS tenants (
  id BIGINT PRIMARY KEY,
  name VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  tenant_id BIGINT PRIMARY KEY,
  status ENUM('logged_out', 'logged_in', 'qr_pending') NOT NULL DEFAULT 'logged_out',
  phone_number VARCHAR(32) NULL,
  qr_code TEXT NULL,
  last_connected_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_whatsapp_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS whatsapp_auth_creds (
  tenant_id BIGINT PRIMARY KEY,
  creds JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_whatsapp_auth_creds_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS whatsapp_auth_keys (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  category VARCHAR(64) NOT NULL,
  key_id VARCHAR(255) NOT NULL,
  value JSON NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_auth_key (tenant_id, category, key_id),
  CONSTRAINT fk_whatsapp_auth_keys_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS received_messages (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  tenant_id BIGINT NOT NULL,
  remote_jid VARCHAR(128) NOT NULL,
  message_id VARCHAR(128) NOT NULL,
  message_type VARCHAR(64) NOT NULL,
  content TEXT NULL,
  received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_received_message (tenant_id, message_id),
  CONSTRAINT fk_received_messages_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS migrations (
  id VARCHAR(255) PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
