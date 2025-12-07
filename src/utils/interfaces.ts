// sf_311_agent/src/utils/interfaces.ts

export interface SF311Case {
  service_request_id: string; // usually number, but API handles as ID
  requested_datetime: string;
  closed_date?: string;
  status_description: string;
  status_notes?: string;
  service_name: string; // Category (e.g., "Street and Sidewalk Cleaning")
  service_subtype: string; // Specific type
  service_details?: string;
  address?: string;
  neighborhoods_sffind_boundaries?: string; // Neighborhood name
  lat?: string;
  long?: string;
  media_url?: string;
}

export interface SF311CaseStats {
  category: string;
  count: string;
}
