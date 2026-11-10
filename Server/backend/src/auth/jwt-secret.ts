export function jwtSecret(): string {
  return process.env.JWT_SECRET ?? 'development-only-secret';
}
