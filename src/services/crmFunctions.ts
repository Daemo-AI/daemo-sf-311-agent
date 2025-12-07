import { DaemoFunction } from "daemo-engine";
import { supabase } from "../app";
import {
  userExists,
  contactExists,
  dealExists,
  noteExists,
} from "../utils/dbHelpers";
import { Deal, DealStage, User } from "../utils/interfaces";
import {
  mapDbDealToApi,
  mapDbContactToApi,
  mapDbNoteToApi,
} from "../utils/mappers";
import axios from "axios";

// Valid deal stages array for validation
export const VALID_DEAL_STAGES = Object.values(DealStage);

import {
  // Contact schemas
  GetContactByIdInputSchema,
  GetContactByIdOutputSchema,
  GetAllContactsInputSchema,
  GetAllContactsOutputSchema,
  SearchContactsByEmailInputSchema,
  SearchContactsByEmailOutputSchema,
  GetContactsByCompanyInputSchema,
  GetContactsByCompanyOutputSchema,
  // Deal schemas
  GetDealByIdInputSchema,
  GetDealByIdOutputSchema,
  GetAllDealsInputSchema,
  GetAllDealsOutputSchema,
  GetDealsByStageInputSchema,
  GetDealsByStageOutputSchema,
  GetDealsByContactInputSchema,
  GetDealsByContactOutputSchema,
  GetDealsByDateRangeInputSchema,
  GetDealsByDateRangeOutputSchema,
  // Note schemas
  GetNoteByIdInputSchema,
  GetNoteByIdOutputSchema,
  GetAllNotesInputSchema,
  GetAllNotesOutputSchema,
  GetNotesByDealInputSchema,
  GetNotesByDealOutputSchema,
  GetNotesByContactInputSchema,
  GetNotesByContactOutputSchema,
  SearchNotesInputSchema,
  SearchNotesOutputSchema,
  // User schemas
  GetUserByIdInputSchema,
  GetUserByIdOutputSchema,
  GetAllUsersInputSchema,
  GetAllUsersOutputSchema,
} from "./crm.schemas";
import z from "zod";

// Helper function to generate embeddings for text
const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/embeddings",
      {
        input: text,
        model: "text-embedding-ada-002",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      },
    );
    return response.data.data[0].embedding;
  } catch (error) {
    console.error("Error generating embedding:", error);
    throw new Error("Failed to generate text embedding");
  }
};

export class CrmFunctions {
  // ============================================================================
  // CONTACT FUNCTIONS
  // ============================================================================

  @DaemoFunction({
    description: "Get a specific contact by their unique ID.",
    tags: ["Contacts", "read"],
    category: "Contacts",
    inputSchema: GetContactByIdInputSchema,
    outputSchema: GetContactByIdOutputSchema,
  })
  async getContactById(
    input: z.infer<typeof GetContactByIdInputSchema>,
  ): Promise<z.infer<typeof GetContactByIdOutputSchema>> {
    const { contact_id } = input;

    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contact_id)
      .single();

    if (error || !data) {
      throw new Error(`Contact not found with ID: ${contact_id}`);
    }

    return mapDbContactToApi(data);
  }

  @DaemoFunction({
    description:
      "Get all contacts from the CRM system, optionally filtered by owner.",
    tags: ["Contacts", "read"],
    category: "Contacts",
    inputSchema: GetAllContactsInputSchema,
    outputSchema: GetAllContactsOutputSchema,
  })
  async getAllContacts(
    input: z.infer<typeof GetAllContactsInputSchema>,
  ): Promise<z.infer<typeof GetAllContactsOutputSchema>> {
    const { owner_id } = input;

    if (owner_id && !(await userExists(owner_id))) {
      throw new Error("Invalid owner ID");
    }

    let query = supabase.from("contacts").select("*");

    if (owner_id) {
      query = query.eq("owner_id", owner_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching contacts:", error);
      throw new Error(`Error fetching contacts: ${error.message}`);
    }

    return data.map((contact) => mapDbContactToApi(contact));
  }

  @DaemoFunction({
    description:
      "Search for contacts by email address (supports partial matching).",
    tags: ["Contacts", "read", "search"],
    category: "Contacts",
    inputSchema: SearchContactsByEmailInputSchema,
    outputSchema: SearchContactsByEmailOutputSchema,
  })
  async searchContactsByEmail(
    input: z.infer<typeof SearchContactsByEmailInputSchema>,
  ): Promise<z.infer<typeof SearchContactsByEmailOutputSchema>> {
    const { email, owner_id } = input;

    if (owner_id && !(await userExists(owner_id))) {
      throw new Error("Invalid owner ID");
    }

    let query = supabase
      .from("contacts")
      .select("*")
      .ilike("email", `%${email}%`);

    if (owner_id) {
      query = query.eq("owner_id", owner_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error searching contacts by email:", error);
      throw new Error(`Error searching contacts: ${error.message}`);
    }

    return data.map((contact) => mapDbContactToApi(contact));
  }

  @DaemoFunction({
    description: "Get all contacts from a specific company.",
    tags: ["Contacts", "read"],
    category: "Contacts",
    inputSchema: GetContactsByCompanyInputSchema,
    outputSchema: GetContactsByCompanyOutputSchema,
  })
  async getContactsByCompany(
    input: z.infer<typeof GetContactsByCompanyInputSchema>,
  ): Promise<z.infer<typeof GetContactsByCompanyOutputSchema>> {
    const { company, owner_id } = input;

    if (owner_id && !(await userExists(owner_id))) {
      throw new Error("Invalid owner ID");
    }

    let query = supabase
      .from("contacts")
      .select("*")
      .ilike("company", `%${company}%`);

    if (owner_id) {
      query = query.eq("owner_id", owner_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching contacts by company:", error);
      throw new Error(`Error fetching contacts: ${error.message}`);
    }

    return data.map((contact) => mapDbContactToApi(contact));
  }

  // ============================================================================
  // DEAL FUNCTIONS
  // ============================================================================

  @DaemoFunction({
    description: "Get a specific deal by its unique ID.",
    tags: ["Deals", "read"],
    category: "Deals",
    inputSchema: GetDealByIdInputSchema,
    outputSchema: GetDealByIdOutputSchema,
  })
  async getDealById(
    input: z.infer<typeof GetDealByIdInputSchema>,
  ): Promise<z.infer<typeof GetDealByIdOutputSchema>> {
    const { deal_id } = input;

    const { data, error } = await supabase
      .from("deals")
      .select(
        `
        *,
        contacts:deal_contacts(contact_id)
      `,
      )
      .eq("id", deal_id)
      .single();

    if (error || !data) {
      throw new Error(`Deal not found with ID: ${deal_id}`);
    }

    const contacts = data.contacts.map((contact: any) => contact.contact_id);
    const { contacts: _, ...dealWithoutContacts } = data;
    return mapDbDealToApi(dealWithoutContacts, contacts);
  }

  @DaemoFunction({
    description:
      "Get all deals from the CRM system, optionally filtered by owner or stage.",
    tags: ["Deals", "read"],
    category: "Deals",
    inputSchema: GetAllDealsInputSchema,
    outputSchema: GetAllDealsOutputSchema,
  })
  async getAllDeals(
    input: z.infer<typeof GetAllDealsInputSchema>,
  ): Promise<z.infer<typeof GetAllDealsOutputSchema>> {
    const { owner_id, stage } = input;

    if (owner_id && !(await userExists(owner_id))) {
      throw new Error("Invalid owner ID");
    }

    if (stage && !VALID_DEAL_STAGES.includes(stage as DealStage)) {
      throw new Error("Invalid deal stage");
    }

    let query = supabase.from("deals").select(`
      *,
      contacts:deal_contacts(contact_id)
    `);

    if (owner_id) {
      query = query.eq("owner_id", owner_id);
    }

    if (stage) {
      query = query.eq("stage", stage);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching deals:", error);
      throw new Error(`Error fetching deals: ${error.message}`);
    }

    const deals: Deal[] = data.map((deal) => {
      const contacts = deal.contacts.map((contact: any) => contact.contact_id);
      const { contacts: _, ...dealWithoutContacts } = deal;
      return mapDbDealToApi(dealWithoutContacts, contacts);
    });

    return deals;
  }

  @DaemoFunction({
    description: "Get all deals at a specific stage in the sales pipeline.",
    tags: ["Deals", "read"],
    category: "Deals",
    inputSchema: GetDealsByStageInputSchema,
    outputSchema: GetDealsByStageOutputSchema,
  })
  async getDealsByStage(
    input: z.infer<typeof GetDealsByStageInputSchema>,
  ): Promise<z.infer<typeof GetDealsByStageOutputSchema>> {
    const { stage, owner_id } = input;

    if (!VALID_DEAL_STAGES.includes(stage as DealStage)) {
      throw new Error("Invalid deal stage");
    }

    if (owner_id && !(await userExists(owner_id))) {
      throw new Error("Invalid owner ID");
    }

    let query = supabase
      .from("deals")
      .select(
        `
      *,
      contacts:deal_contacts(contact_id)
    `,
      )
      .eq("stage", stage);

    if (owner_id) {
      query = query.eq("owner_id", owner_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching deals by stage:", error);
      throw new Error(`Error fetching deals: ${error.message}`);
    }

    const deals: Deal[] = data.map((deal) => {
      const contacts = deal.contacts.map((contact: any) => contact.contact_id);
      const { contacts: _, ...dealWithoutContacts } = deal;
      return mapDbDealToApi(dealWithoutContacts, contacts);
    });

    return deals;
  }

  @DaemoFunction({
    description: "Get all deals associated with a specific contact.",
    tags: ["Deals", "read"],
    category: "Deals",
    inputSchema: GetDealsByContactInputSchema,
    outputSchema: GetDealsByContactOutputSchema,
  })
  async getDealsByContact(
    input: z.infer<typeof GetDealsByContactInputSchema>,
  ): Promise<z.infer<typeof GetDealsByContactOutputSchema>> {
    const { contact_id } = input;

    if (!(await contactExists(contact_id))) {
      throw new Error(`Contact not found with ID: ${contact_id}`);
    }

    // First, get all deal IDs associated with this contact
    const { data: dealContacts, error: dealContactsError } = await supabase
      .from("deal_contacts")
      .select("deal_id")
      .eq("contact_id", contact_id);

    if (dealContactsError) {
      console.error("Error fetching deal contacts:", dealContactsError);
      throw new Error(`Error fetching deals: ${dealContactsError.message}`);
    }

    if (!dealContacts || dealContacts.length === 0) {
      return [];
    }

    const dealIds = dealContacts.map((dc) => dc.deal_id);

    // Then fetch the full deal data
    const { data, error } = await supabase
      .from("deals")
      .select(
        `
      *,
      contacts:deal_contacts(contact_id)
    `,
      )
      .in("id", dealIds);

    if (error) {
      console.error("Error fetching deals:", error);
      throw new Error(`Error fetching deals: ${error.message}`);
    }

    const deals: Deal[] = data.map((deal) => {
      const contacts = deal.contacts.map((contact: any) => contact.contact_id);
      const { contacts: _, ...dealWithoutContacts } = deal;
      return mapDbDealToApi(dealWithoutContacts, contacts);
    });

    return deals;
  }

  @DaemoFunction({
    description:
      "Get deals within a specific date range based on expected close date.",
    tags: ["Deals", "read"],
    category: "Deals",
    inputSchema: GetDealsByDateRangeInputSchema,
    outputSchema: GetDealsByDateRangeOutputSchema,
  })
  async getDealsByDateRange(
    input: z.infer<typeof GetDealsByDateRangeInputSchema>,
  ): Promise<z.infer<typeof GetDealsByDateRangeOutputSchema>> {
    const { start_date, end_date, owner_id } = input;

    if (owner_id && !(await userExists(owner_id))) {
      throw new Error("Invalid owner ID");
    }

    let query = supabase.from("deals").select(`
      *,
      contacts:deal_contacts(contact_id)
    `);

    if (start_date) {
      query = query.gte("expected_close_date", start_date);
    }

    if (end_date) {
      query = query.lte("expected_close_date", end_date);
    }

    if (owner_id) {
      query = query.eq("owner_id", owner_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching deals by date range:", error);
      throw new Error(`Error fetching deals: ${error.message}`);
    }

    const deals: Deal[] = data.map((deal) => {
      const contacts = deal.contacts.map((contact: any) => contact.contact_id);
      const { contacts: _, ...dealWithoutContacts } = deal;
      return mapDbDealToApi(dealWithoutContacts, contacts);
    });

    return deals;
  }

  // ============================================================================
  // NOTE FUNCTIONS
  // ============================================================================

  @DaemoFunction({
    description: "Get a specific note by its unique ID.",
    tags: ["Notes", "read"],
    category: "Notes",
    inputSchema: GetNoteByIdInputSchema,
    outputSchema: GetNoteByIdOutputSchema,
  })
  async getNoteById(
    input: z.infer<typeof GetNoteByIdInputSchema>,
  ): Promise<z.infer<typeof GetNoteByIdOutputSchema>> {
    const { note_id } = input;

    const { data, error } = await supabase
      .from("notes")
      .select(
        `
        *,
        contacts:note_contacts(contact_id)
      `,
      )
      .eq("id", note_id)
      .single();

    if (error || !data) {
      throw new Error(`Note not found with ID: ${note_id}`);
    }

    const {
      content_vector,
      contacts: contactsRelation,
      ...noteWithoutVector
    } = data;
    const contactIds = contactsRelation.map((c: any) => c.contact_id);
    return mapDbNoteToApi(noteWithoutVector, contactIds);
  }

  @DaemoFunction({
    description:
      "Get all notes from the CRM system, optionally filtered by owner or deal.",
    tags: ["Notes", "read"],
    category: "Notes",
    inputSchema: GetAllNotesInputSchema,
    outputSchema: GetAllNotesOutputSchema,
  })
  async getAllNotes(
    input: z.infer<typeof GetAllNotesInputSchema>,
  ): Promise<z.infer<typeof GetAllNotesOutputSchema>> {
    const { owner_id, deal_id } = input;

    if (owner_id && !(await userExists(owner_id))) {
      throw new Error("Invalid owner ID");
    }

    if (deal_id && !(await dealExists(deal_id))) {
      throw new Error("Invalid deal ID");
    }

    let query = supabase.from("notes").select(`
      *,
      contacts:note_contacts(contact_id)
    `);

    if (owner_id) {
      query = query.eq("owner_id", owner_id);
    }

    if (deal_id) {
      query = query.eq("deal_id", deal_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching notes:", error);
      throw new Error(`Error fetching notes: ${error.message}`);
    }

    const notes = data.map((note) => {
      const {
        content_vector,
        contacts: contactsRelation,
        ...noteWithoutVector
      } = note;
      return {
        ...noteWithoutVector,
        contacts: contactsRelation.map((c: any) => c.contact_id),
      };
    });

    // Sort by meeting_date descending
    notes.sort(
      (a, b) =>
        new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime(),
    );

    return notes;
  }

  @DaemoFunction({
    description: "Get all notes associated with a specific deal.",
    tags: ["Notes", "read"],
    category: "Notes",
    inputSchema: GetNotesByDealInputSchema,
    outputSchema: GetNotesByDealOutputSchema,
  })
  async getNotesByDeal(
    input: z.infer<typeof GetNotesByDealInputSchema>,
  ): Promise<z.infer<typeof GetNotesByDealOutputSchema>> {
    const { deal_id } = input;

    if (!(await dealExists(deal_id))) {
      throw new Error(`Deal not found with ID: ${deal_id}`);
    }

    const { data, error } = await supabase
      .from("notes")
      .select(
        `
        *,
        contacts:note_contacts(contact_id)
      `,
      )
      .eq("deal_id", deal_id);

    if (error) {
      console.error("Error fetching notes for deal:", error);
      throw new Error(`Error fetching notes: ${error.message}`);
    }

    const notes = data.map((note) => {
      const {
        content_vector,
        contacts: contactsRelation,
        ...noteWithoutVector
      } = note;
      return {
        ...noteWithoutVector,
        contacts: contactsRelation.map((c: any) => c.contact_id),
      };
    });

    // Sort by meeting_date descending
    notes.sort(
      (a, b) =>
        new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime(),
    );

    return notes;
  }

  @DaemoFunction({
    description: "Get all notes associated with a specific contact.",
    tags: ["Notes", "read"],
    category: "Notes",
    inputSchema: GetNotesByContactInputSchema,
    outputSchema: GetNotesByContactOutputSchema,
  })
  async getNotesByContact(
    input: z.infer<typeof GetNotesByContactInputSchema>,
  ): Promise<z.infer<typeof GetNotesByContactOutputSchema>> {
    const { contact_id } = input;

    if (!(await contactExists(contact_id))) {
      throw new Error(`Contact not found with ID: ${contact_id}`);
    }

    // First, get all note IDs associated with this contact
    const { data: noteContacts, error: noteContactsError } = await supabase
      .from("note_contacts")
      .select("note_id")
      .eq("contact_id", contact_id);

    if (noteContactsError) {
      console.error("Error fetching note IDs for contact:", noteContactsError);
      throw new Error(`Error fetching notes: ${noteContactsError.message}`);
    }

    if (!noteContacts || noteContacts.length === 0) {
      return [];
    }

    const noteIds = noteContacts.map((nc) => nc.note_id);

    // Then fetch the full note data
    const { data, error } = await supabase
      .from("notes")
      .select(
        `
        *,
        contacts:note_contacts(contact_id)
      `,
      )
      .in("id", noteIds);

    if (error) {
      console.error("Error fetching notes:", error);
      throw new Error(`Error fetching notes: ${error.message}`);
    }

    const notes = data.map((note) => {
      const {
        content_vector,
        contacts: contactsRelation,
        ...noteWithoutVector
      } = note;
      return {
        ...noteWithoutVector,
        contacts: contactsRelation.map((c: any) => c.contact_id),
      };
    });

    // Sort by meeting_date descending
    notes.sort(
      (a, b) =>
        new Date(b.meeting_date).getTime() - new Date(a.meeting_date).getTime(),
    );

    return notes;
  }

  @DaemoFunction({
    description:
      "Perform semantic search through notes using natural language queries. Returns notes ranked by relevance.",
    tags: ["Notes", "read", "search", "semantic"],
    category: "Notes",
    inputSchema: SearchNotesInputSchema,
    outputSchema: SearchNotesOutputSchema,
  })
  async searchNotes(
    input: z.infer<typeof SearchNotesInputSchema>,
  ): Promise<z.infer<typeof SearchNotesOutputSchema>> {
    const { query, limit = 10, owner_id } = input;

    if (owner_id && !(await userExists(owner_id))) {
      throw new Error("Invalid owner ID");
    }

    // Generate embedding for the search query
    const queryEmbedding = await generateEmbedding(query);

    const rpcCall: any = {
      query_embedding: queryEmbedding,
      match_threshold: 0.5,
      match_count: limit,
    };

    if (owner_id) {
      rpcCall["p_owner_id"] = owner_id;
    }

    // Call the stored procedure for vector search
    const { data, error } = await supabase.rpc("search_notes", rpcCall);

    if (error) {
      console.error("Error performing search:", error);
      throw new Error(`Error performing search: ${error.message}`);
    }

    // Fetch contact information for each note
    const noteIds = data.map((note: any) => note.id);

    // Get note-contact relationships
    const { data: contactRelations, error: contactsError } = await supabase
      .from("note_contacts")
      .select("note_id, contact_id")
      .in("note_id", noteIds);

    if (contactsError) {
      console.error("Error fetching note contacts:", contactsError);
    }

    // Group contacts by note_id
    const contactsByNoteId: any = {};
    if (contactRelations) {
      contactRelations.forEach((relation) => {
        if (!contactsByNoteId[relation.note_id]) {
          contactsByNoteId[relation.note_id] = [];
        }
        contactsByNoteId[relation.note_id].push(relation.contact_id);
      });
    }

    // Add contacts to notes and format the result
    const notes = data.map((note: any) => {
      const { similarity, ...noteData } = note;
      const contacts = contactsByNoteId[note.id] || [];
      const mappedNote = mapDbNoteToApi(noteData, contacts);
      return {
        ...mappedNote,
        score: similarity,
      };
    });

    return notes;
  }

  // ============================================================================
  // USER FUNCTIONS
  // ============================================================================

  @DaemoFunction({
    description: "Get a specific user by their unique ID.",
    tags: ["Users", "read"],
    category: "Users",
    inputSchema: GetUserByIdInputSchema,
    outputSchema: GetUserByIdOutputSchema,
  })
  async getUserById(
    input: z.infer<typeof GetUserByIdInputSchema>,
  ): Promise<z.infer<typeof GetUserByIdOutputSchema>> {
    const { user_id } = input;

    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, user_info, created_at, updated_at")
      .eq("id", user_id)
      .single();

    if (error || !data) {
      throw new Error(`User not found with ID: ${user_id}`);
    }

    return data as User;
  }

  @DaemoFunction({
    description: "Get all users in the CRM system.",
    tags: ["Users", "read"],
    category: "Users",
    inputSchema: GetAllUsersInputSchema,
    outputSchema: GetAllUsersOutputSchema,
  })
  async getAllUsers(
    input: z.infer<typeof GetAllUsersInputSchema>,
  ): Promise<z.infer<typeof GetAllUsersOutputSchema>> {
    const { data, error } = await supabase
      .from("users")
      .select("id, name, email, role, user_info, created_at, updated_at");

    if (error) {
      console.error("Error fetching users:", error);
      throw new Error(`Error fetching users: ${error.message}`);
    }

    return data as User[];
  }
}
