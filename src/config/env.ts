function requireEnv(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const env = {
  port: parseInt(optionalEnv('PORT', '6000'), 10),
  databaseHost: optionalEnv('DATABASE_HOST', '127.0.0.1'),
  databasePort: parseInt(optionalEnv('DATABASE_PORT', '3306'), 10),
  databaseUsername: optionalEnv('DATABASE_USER', optionalEnv('DATABASE_USERNAME', 'root')),
  databasePassword: optionalEnv('DATABASE_PASSWORD', ''),
  databaseName: optionalEnv('DATABASE_NAME', 'whatsapp_api'),
  jwtSecretKey: optionalEnv('JWT_SECRET_KEY', 'msdu8nbrdkdhe7'),
  jwtSecretPublicKey: optionalEnv('JWT_SECRET_KEY_PUBLIC', 'msdu8nbrdkdhe7++'),
  jwtAccessTokenTime: parseInt(optionalEnv('JWT_ACCESS_TOKEN_TIME', '10'), 10),
  testTenantId: parseInt(optionalEnv('TEST_TENANT_ID', '0'), 10),
  testJwtToken: optionalEnv('TEST_JWT_TOKEN', ''),
  testRecipientPhone: optionalEnv('TEST_RECIPIENT_PHONE', ''),
  whatsappBrowserName: optionalEnv('WHATSAPP_BROWSER_NAME', 'wpapi'),
} as const;

export { requireEnv, optionalEnv };
