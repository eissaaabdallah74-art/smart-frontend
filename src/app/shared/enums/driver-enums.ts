// src/app/shared/enums/driver-enums.ts

// 1) Driver.contractStatus (operational status)
export const DRIVER_CONTRACT_STATUSES = [
  'Active',
  'Inactive',
  'Unreachable/Reschedule',
  'Resigned',
  'Hold zone',
] as const;

export type DriverContractStatus = (typeof DRIVER_CONTRACT_STATUSES)[number];

// 2) Interview.signedWithHr + Driver.signedWithHr (HR outcome)
export const SIGNED_WITH_HR_STATUSES = [
  'Signed A Contract With HR',
  'Will Think About Our Offers',
  'Missing documents',
  'Unqualified',
] as const;

export type SignedWithHrStatus = (typeof SIGNED_WITH_HR_STATUSES)[number];

// 3) SecurityResult
export const SECURITY_RESULTS = ['Positive', 'Negative'] as const;
export type SecurityResult = (typeof SECURITY_RESULTS)[number];

// Guards (optional helpers)
export function isDriverContractStatus(v: any): v is DriverContractStatus {
  return DRIVER_CONTRACT_STATUSES.includes(v);
}
export function isSignedWithHrStatus(v: any): v is SignedWithHrStatus {
  return SIGNED_WITH_HR_STATUSES.includes(v);
}
export function isSecurityResult(v: any): v is SecurityResult {
  return SECURITY_RESULTS.includes(v);
}
