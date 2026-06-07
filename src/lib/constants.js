// Tenant-scoped constants live here so admin/security-gating IDs stay
// co-located with other Azure AD identifiers (CLIENT_ID, TENANT_ID,
// DATAVERSE_URL in src/lib/msal.js) and so future UI surfaces (an
// admin-only sidebar entry, a "request access" CTA, etc.) can import
// the same ID without each component shipping its own copy.

/**
 * Entra ID security group "BT Ttech Business" (39 direct members at
 * provisioning time). Membership in this group gates the admin tabs in
 * /settings (AI Asistanlar / AI Çözümler / İş Uygulamaları). The check
 * lives in src/hooks/useIsInGroup — primary read off
 * `account.idTokenClaims.groups`, fallback to
 * Microsoft Graph `POST /me/checkMemberGroups`.
 */
export const ADMIN_GROUP_ID = "62b4ed73-59aa-4397-be26-d2891675f867"
