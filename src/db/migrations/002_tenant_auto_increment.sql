-- Migration: 002_tenant_auto_increment
-- Allow tenant registration without a pre-assigned id

ALTER TABLE tenants MODIFY id BIGINT NOT NULL AUTO_INCREMENT;
