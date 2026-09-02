export const healthStatus = {
  service: 'tatu',
  stage: 'technical-foundation',
  status: 'healthy',
} as const;

export type HealthStatus = typeof healthStatus;

export function getHealthStatus(): HealthStatus {
  return healthStatus;
}
