// src/app/models/types.ts

export type Permissions = {
  isAdmin: boolean;
  canUseAiAssistant: boolean;
  canViewUsers: boolean;
  canCreateEntries: boolean;
  canViewFinance: boolean;
};

export enum SystemRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  STAFF = 'STAFF'
}

export interface User {
  name: string;
  email: string;
  password?: string;
  role: SystemRole;
  position: string;
}

export interface Driver {
  courierId: string;
  name: string;
  phone?: string;
  client?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ON_HOLD';
}

export interface Contractor {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  rate?: number;
}

export interface Client {
  id: number;
  name: string;
  accountManager?: string;
}

export type Experience = { title: string; company: string; duration: string };

export interface Candidate {
  name: string;
  role: string;
  summary: string;
  experience: Experience[];
  skills: string[];
  education: string;
}
