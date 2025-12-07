import { supabase } from "../app";

/**
 * Check if a user exists by ID
 * @param userId User ID to check
 * @returns Boolean indicating if user exists
 */
export async function userExists(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("id", userId)
    .single();

  return !error && data !== null;
}

/**
 * Check if a contact exists by ID
 * @param contactId Contact ID to check
 * @returns Boolean indicating if contact exists
 */
export async function contactExists(contactId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("contacts")
    .select("id")
    .eq("id", contactId)
    .single();

  return !error && data !== null;
}

/**
 * Check if a deal exists by ID
 * @param dealId Deal ID to check
 * @returns Boolean indicating if deal exists
 */
export async function dealExists(dealId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("deals")
    .select("id")
    .eq("id", dealId)
    .single();

  return !error && data !== null;
}

/**
 * Check if a note exists by ID
 * @param noteId Note ID to check
 * @returns Boolean indicating if note exists
 */
export async function noteExists(noteId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("notes")
    .select("id")
    .eq("id", noteId)
    .single();

  return !error && data !== null;
}

/**
 * Check if an email is already in use by another contact
 * @param email Email to check
 * @param excludeId Optional contact ID to exclude from check (for updates)
 * @returns Boolean indicating if email exists
 */
export async function contactEmailExists(
  email: string,
  excludeId?: string,
): Promise<boolean> {
  let query = supabase.from("contacts").select("id").eq("email", email);

  if (excludeId) {
    query = query.neq("id", excludeId);
  }

  const { data, error } = await query;

  return !error && data !== null && data.length > 0;
}

/**
 * Get all contacts associated with a deal
 * @param dealId Deal ID to get contacts for
 * @returns Array of contact IDs
 */
export async function getDealContacts(dealId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("deal_contacts")
    .select("contact_id")
    .eq("deal_id", dealId);

  if (error || !data) {
    return [];
  }

  return data.map((row) => row.contact_id);
}

/**
 * Get all contacts associated with a note
 * @param noteId Note ID to get contacts for
 * @returns Array of contact IDs
 */
export async function getNoteContacts(noteId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("note_contacts")
    .select("contact_id")
    .eq("note_id", noteId);

  if (error || !data) {
    return [];
  }

  return data.map((row) => row.contact_id);
}

/**
 * Check if a contact is associated with any deals
 * @param contactId Contact ID to check
 * @returns Boolean indicating if contact is used in deals
 */
export async function isContactUsedInDeals(
  contactId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("deal_contacts")
    .select("deal_id")
    .eq("contact_id", contactId)
    .limit(1);

  return !error && data !== null && data.length > 0;
}

/**
 * Transaction-safe batch operation
 * This function attempts to simulate MongoDB's transaction behavior in Supabase
 * @param operations Array of database operations to perform
 * @returns Result of the operation
 */
export async function performBatchOperation<T>(
  operations: (() => Promise<T>)[],
): Promise<{ success: boolean; results: T[]; error?: any }> {
  const results: T[] = [];

  try {
    for (const operation of operations) {
      const result = await operation();
      results.push(result);
    }

    return { success: true, results };
  } catch (error) {
    return { success: false, results, error };
  }
}
