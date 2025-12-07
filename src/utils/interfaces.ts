/**
 * Base entity interface with common properties
 */
export interface BaseEntity {
  id: string; // UUID in PostgreSQL
  created_at: string;
  updated_at: string;
}

export enum UserRole {
  ADMIN = "admin",
  SALESPERSON = "salesperson",
}

/**
 * User interface
 */
export interface User extends BaseEntity {
  name: string;
  email: string;
  role: UserRole;
  user_info: Record<string, any>;
}

/**
 * Contact interface
 */
export interface Contact extends BaseEntity {
  owner_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  job_title: string;
}

/**
 * Deal stages enum
 */
export enum DealStage {
  LEAD_IDENTIFIED = "Lead Identified",
  MEETING_SCHEDULED = "Meeting Scheduled",
  DEMO_COMPLETED = "Demo Completed",
  PROPOSAL_SENT = "Proposal Sent",
  FOLLOW_UP = "Follow-Up",
  CONTRACT_SENT = "Contract Sent",
  CLOSED_WON = "Closed Won",
  CLOSED_LOST = "Closed Lost",
}

/**
 * Deal interface
 */
export interface Deal extends BaseEntity {
  owner_id: string;
  title: string;
  description: string;
  deal_amount: number;
  stage: DealStage;
  probability: number;
  expected_close_date: string | null;
  actual_close_date: string | null;
  contacts: string[]; // Array of contact IDs
}

/**
 * Note interface
 */
export interface Note extends BaseEntity {
  owner_id: string;
  deal_id: string | null;
  meeting_date: string;
  title: string;
  note_content: string;
  contacts: string[]; // Array of contact IDs
}

/**
 * Note with search score (for search results)
 */
export interface NoteSearchResult extends Note {
  score: number;
}

/**
 * Request interfaces for creating entities
 */

export interface CreateContactRequest {
  owner_id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
}

export interface CreateDealRequest {
  owner_id: string;
  title: string;
  description?: string;
  deal_amount?: number;
  stage?: DealStage;
  probability?: number;
  expectedCloseDate?: string;
  contacts?: string[];
}

export interface CreateNoteRequest {
  owner_id: string;
  deal?: string | null;
  contacts?: string[];
  meetingDate?: string;
  title: string;
  noteContent: string;
}

/**
 * Response interfaces
 */

export interface ApiResponse<T> {
  message: string;
  data?: T;
  error?: string;
}

export interface BatchResult<T> {
  successful: T[];
  failed: {
    item: string;
    reason: string;
  }[];
}
