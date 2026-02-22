// src/app/models/company-documents/company-documents.models.ts

export type CompanyDocStatus = 'NEW' | 'ONGOING' | 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';

export type CompanyRef = {
  id?: number;
  code?: string;
  name?: string;
};

export type DocTypeRef = {
  id?: number;
  code?: string;
  name?: string;
  nameEn?: string;
};

export type CompanyDocumentComputed = {
  status?: CompanyDocStatus;
  remainingDays?: number | null;
  computedExpiryDate?: string | null; // YYYY-MM-DD preferred
};

export type CompanyDocument = {
  id: number;

  documentNumber?: string | null;

  company?: CompanyRef | null;
  type?: DocTypeRef | null;

  issueDate?: string | null;        // "YYYY-MM-DD"
  expiryDate?: string | null;       // optional if API provides
  validityYears?: number | null;    // optional (if expiry derived)

  currentLocation?: string | null;  // e.g. "HR safe"
  notes?: string | null;

  remindAt?: string | null;         // optional
  remindNote?: string | null;

  custodianName?: string | null;
  custodianPhone?: string | null;
  custodianRole?: string | null;
  custodianOrganization?: string | null;

  computed?: CompanyDocumentComputed | null;
};
