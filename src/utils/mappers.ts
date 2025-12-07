import {
  Contact,
  Deal,
  Note,
  CreateContactRequest,
  CreateDealRequest,
  CreateNoteRequest,
} from "./interfaces";

/**
 * Convert database contact (snake_case) to API contact (camelCase)
 */
export function mapDbContactToApi(dbContact: any): Contact {
  return {
    id: dbContact.id,
    owner_id: dbContact.owner_id,
    first_name: dbContact.first_name,
    last_name: dbContact.last_name,
    email: dbContact.email,
    phone: dbContact.phone || "",
    company: dbContact.company || "",
    job_title: dbContact.job_title || "",
    created_at: dbContact.created_at,
    updated_at: dbContact.updated_at,
  };
}

/**
 * Convert API contact request (camelCase) to database contact (snake_case)
 */
export function mapApiContactToDb(apiContact: CreateContactRequest): any {
  return {
    owner_id: apiContact.owner_id,
    first_name: apiContact.firstName,
    last_name: apiContact.lastName,
    email: apiContact.email,
    phone: apiContact.phone || "",
    company: apiContact.company || "",
    job_title: apiContact.jobTitle || "",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Convert database deal (snake_case) to API deal (camelCase)
 */
export function mapDbDealToApi(dbDeal: any, contacts: string[] = []): Deal {
  return {
    id: dbDeal.id,
    owner_id: dbDeal.owner_id,
    title: dbDeal.title,
    description: dbDeal.description || "",
    deal_amount: dbDeal.deal_amount || 0,
    stage: dbDeal.stage,
    probability: dbDeal.probability || 0,
    expected_close_date: dbDeal.expected_close_date,
    actual_close_date: dbDeal.actual_close_date,
    contacts: contacts,
    created_at: dbDeal.created_at,
    updated_at: dbDeal.updated_at,
  };
}

/**
 * Convert API deal request (camelCase) to database deal (snake_case)
 */
export function mapApiDealToDb(apiDeal: CreateDealRequest): any {
  return {
    owner_id: apiDeal.owner_id,
    title: apiDeal.title,
    description: apiDeal.description || "",
    deal_amount: apiDeal.deal_amount || 0,
    stage: apiDeal.stage || "Lead Identified",
    probability: apiDeal.probability || 0,
    expected_close_date: apiDeal.expectedCloseDate
      ? new Date(apiDeal.expectedCloseDate).toISOString()
      : null,
    actual_close_date: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Convert database note (snake_case) to API note (camelCase)
 */
export function mapDbNoteToApi(dbNote: any, contacts: string[] = []): Note {
  return {
    id: dbNote.id,
    owner_id: dbNote.owner_id,
    deal_id: dbNote.deal_id,
    meeting_date: dbNote.meeting_date,
    title: dbNote.title,
    note_content: dbNote.note_content,
    contacts: contacts,
    created_at: dbNote.created_at,
    updated_at: dbNote.updated_at,
  };
}

/**
 * Convert API note request (camelCase) to database note (snake_case)
 */
export function mapApiNoteToDb(apiNote: CreateNoteRequest): any {
  return {
    owner_id: apiNote.owner_id,
    deal_id: apiNote.deal || null,
    meeting_date: apiNote.meetingDate
      ? new Date(apiNote.meetingDate).toISOString()
      : new Date().toISOString(),
    title: apiNote.title,
    note_content: apiNote.noteContent,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Generate deal-contact relationships for database
 */
export function generateDealContactRelations(
  dealId: string,
  contactIds: string[],
): any[] {
  return contactIds.map((contactId) => ({
    deal_id: dealId,
    contact_id: contactId,
    created_at: new Date().toISOString(),
  }));
}

/**
 * Generate note-contact relationships for database
 */
export function generateNoteContactRelations(
  noteId: string,
  contactIds: string[],
): any[] {
  return contactIds.map((contactId) => ({
    note_id: noteId,
    contact_id: contactId,
    created_at: new Date().toISOString(),
  }));
}
