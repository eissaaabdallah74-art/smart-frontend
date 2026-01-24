import { DocType, DocumentStatus } from "../../../services/employs/employs-service.service";

export const DOC_TYPES: Array<{ key: DocType; label: string }> = [
  { key: 'work_stub', label: 'Work Stub (كعب عمل)' },
  { key: 'insurance_print', label: 'Insurance Print (برنت تأمينات)' },
  { key: 'id_copy', label: 'ID Copy (صورة البطاقة)' },
  { key: 'criminal_record', label: 'Criminal Record (فيش جنائي)' },
  { key: 'utilities_receipt', label: 'Utilities Receipt (إيصال مرافق)' },
  { key: 'personal_photos', label: 'Personal Photos (صور شخصية)' },
  { key: 'qualification', label: 'Qualification (المؤهل الدراسي)' },
  { key: 'birth_certificate', label: 'Birth Certificate (شهادة الميلاد)' },
  { key: 'military_status', label: 'Military Status (موقف التجنيد)' },
  { key: 'employment_contract', label: 'Employment Contract (عقد العمل)' },
  { key: 'other', label: 'Other' },
];

export const DOC_STATUS: Array<{ key: DocumentStatus; label: string }> = [
  { key: 'missing', label: 'Missing' },
  { key: 'provided', label: 'Provided' },
  { key: 'copy', label: 'Copy' },
  { key: 'not_applicable', label: 'N/A' },
];
