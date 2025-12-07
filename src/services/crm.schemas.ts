// daemo-crm-backend-supabase/src/services/crm.schemas.ts
import { z } from "zod";
import { DealStage, UserRole } from "../utils/interfaces";

// ============================================================================
// CONTACT SCHEMAS
// ============================================================================

export const GetContactByIdInputSchema = z
  .object({
    contact_id: z
      .string()
      .uuid()
      .describe("The UUID of the contact to retrieve."),
  })
  .describe("Parameters for getting a contact by ID.");

export const ContactOutputSchema = z.object({
  id: z.string().uuid().describe("The unique ID of the contact."),
  owner_id: z.string().describe("The ID of the user who owns this contact."),
  first_name: z.string().describe("The first name of the contact."),
  last_name: z.string().describe("The last name of the contact."),
  email: z.string().email().describe("The contact's email address."),
  phone: z.string().describe("The contact's phone number."),
  company: z.string().describe("The company the contact works for."),
  job_title: z.string().describe("The contact's job title."),
  created_at: z.string().describe("Timestamp of creation."),
  updated_at: z.string().describe("Timestamp of last update."),
});

export const GetContactByIdOutputSchema = ContactOutputSchema;

export const GetAllContactsInputSchema = z
  .object({
    owner_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filter contacts by owner ID."),
  })
  .describe("Parameters for fetching all contacts.");

export const GetAllContactsOutputSchema = z.array(ContactOutputSchema);

export const SearchContactsByEmailInputSchema = z
  .object({
    email: z
      .string()
      .describe("Email address to search for (partial match supported)."),
    owner_id: z.string().uuid().optional().describe("Filter by owner ID."),
  })
  .describe("Parameters for searching contacts by email.");

export const SearchContactsByEmailOutputSchema = z.array(ContactOutputSchema);

export const GetContactsByCompanyInputSchema = z
  .object({
    company: z.string().describe("Company name to search for."),
    owner_id: z.string().uuid().optional().describe("Filter by owner ID."),
  })
  .describe("Parameters for getting contacts by company.");

export const GetContactsByCompanyOutputSchema = z.array(ContactOutputSchema);

// ============================================================================
// DEAL SCHEMAS
// ============================================================================

export const GetDealByIdInputSchema = z
  .object({
    deal_id: z.string().uuid().describe("The UUID of the deal to retrieve."),
  })
  .describe("Parameters for getting a deal by ID.");

export const DealOutputSchema = z.object({
  id: z.string().uuid().describe("The unique ID of the deal."),
  owner_id: z.string().describe("The ID of the user who owns this deal."),
  title: z.string().describe("Title of the deal."),
  description: z.string().describe("Description of the deal."),
  deal_amount: z.number().describe("Deal value/amount."),
  stage: z.nativeEnum(DealStage).describe("Stage of the deal."),
  probability: z.number().describe("Probability that the deal will close."),
  expected_close_date: z
    .string()
    .nullable()
    .describe("Expected close date for the deal."),
  actual_close_date: z
    .string()
    .nullable()
    .describe("The actual close date for the deal."),
  contacts: z
    .array(z.string())
    .describe("Array of contact IDs associated with this deal."),
  created_at: z.string().describe("Timestamp of creation."),
  updated_at: z.string().describe("Timestamp of last update."),
});

export const GetDealByIdOutputSchema = DealOutputSchema;

export const GetAllDealsInputSchema = z
  .object({
    owner_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filter deals by owner ID."),
    stage: z
      .nativeEnum(DealStage)
      .optional()
      .describe("Filter deals by stage."),
  })
  .describe("Parameters for fetching deals.");

export const GetAllDealsOutputSchema = z.array(DealOutputSchema);

export const GetDealsByStageInputSchema = z
  .object({
    stage: z.nativeEnum(DealStage).describe("The stage to filter deals by."),
    owner_id: z.string().uuid().optional().describe("Filter by owner ID."),
  })
  .describe("Parameters for getting deals by stage.");

export const GetDealsByStageOutputSchema = z.array(DealOutputSchema);

export const GetDealsByContactInputSchema = z
  .object({
    contact_id: z
      .string()
      .uuid()
      .describe("The contact ID to find associated deals for."),
  })
  .describe("Parameters for getting deals by contact.");

export const GetDealsByContactOutputSchema = z.array(DealOutputSchema);

export const GetDealsByDateRangeInputSchema = z
  .object({
    start_date: z
      .string()
      .optional()
      .describe("Start date for filtering (ISO 8601 format)."),
    end_date: z
      .string()
      .optional()
      .describe("End date for filtering (ISO 8601 format)."),
    owner_id: z.string().uuid().optional().describe("Filter by owner ID."),
  })
  .describe("Parameters for getting deals by expected close date range.");

export const GetDealsByDateRangeOutputSchema = z.array(DealOutputSchema);

// ============================================================================
// NOTE SCHEMAS
// ============================================================================

export const GetNoteByIdInputSchema = z
  .object({
    note_id: z.string().uuid().describe("The UUID of the note to retrieve."),
  })
  .describe("Parameters for getting a note by ID.");

export const NoteOutputSchema = z.object({
  id: z.string().uuid().describe("The unique ID of the note."),
  owner_id: z.string().describe("The ID of the user who owns this note."),
  deal_id: z
    .string()
    .nullable()
    .describe("The ID of the associated deal, if any."),
  meeting_date: z.string().describe("The date/time of the meeting."),
  title: z.string().describe("Title of the note."),
  note_content: z.string().describe("Content of the note."),
  contacts: z
    .array(z.string())
    .describe("Array of contact IDs associated with this note."),
  created_at: z.string().describe("Timestamp of creation."),
  updated_at: z.string().describe("Timestamp of last update."),
});

export const GetNoteByIdOutputSchema = NoteOutputSchema;

export const GetAllNotesInputSchema = z
  .object({
    owner_id: z
      .string()
      .uuid()
      .optional()
      .describe("Filter notes by owner ID."),
    deal_id: z.string().uuid().optional().describe("Filter notes by deal ID."),
  })
  .describe("Parameters for fetching all notes.");

export const GetAllNotesOutputSchema = z.array(NoteOutputSchema);

export const GetNotesByDealInputSchema = z
  .object({
    deal_id: z
      .string()
      .uuid()
      .describe("The deal ID to find associated notes for."),
  })
  .describe("Parameters for getting notes by deal.");

export const GetNotesByDealOutputSchema = z.array(NoteOutputSchema);

export const GetNotesByContactInputSchema = z
  .object({
    contact_id: z
      .string()
      .uuid()
      .describe("The contact ID to find associated notes for."),
  })
  .describe("Parameters for getting notes by contact.");

export const GetNotesByContactOutputSchema = z.array(NoteOutputSchema);

export const SearchNotesInputSchema = z
  .object({
    query: z
      .string()
      .describe("The search query for semantic search through notes."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .default(10)
      .describe("Maximum number of results to return."),
    owner_id: z.string().uuid().optional().describe("Filter by owner ID."),
  })
  .describe("Parameters for semantic search through notes.");

export const NoteSearchResultSchema = NoteOutputSchema.extend({
  score: z.number().describe("Similarity score for the search result."),
});

export const SearchNotesOutputSchema = z.array(NoteSearchResultSchema);

// ============================================================================
// USER SCHEMAS
// ============================================================================

export const GetUserByIdInputSchema = z
  .object({
    user_id: z.string().uuid().describe("The UUID of the user to retrieve."),
  })
  .describe("Parameters for getting a user by ID.");

export const UserOutputSchema = z.object({
  id: z.string().uuid().describe("The unique ID of the user."),
  name: z.string().describe("The user's name."),
  email: z.string().email().describe("The user's email address."),
  role: z.nativeEnum(UserRole).describe("The user's role in the system."),
  user_info: z
    .record(z.any())
    .describe("Additional user information as key-value pairs."),
  created_at: z.string().describe("Timestamp of creation."),
  updated_at: z.string().describe("Timestamp of last update."),
});

export const GetUserByIdOutputSchema = UserOutputSchema;

export const GetAllUsersInputSchema = z
  .object({})
  .describe("Parameters for fetching all users.");

export const GetAllUsersOutputSchema = z.array(UserOutputSchema);
