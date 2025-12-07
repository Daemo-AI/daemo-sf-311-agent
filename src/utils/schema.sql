-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a health check table (used for testing database connection)
CREATE TABLE IF NOT EXISTS health_check (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'salesperson' CHECK (role IN ('admin', 'salesperson')),
    user_info JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT DEFAULT '',
    company TEXT DEFAULT '',
    job_title TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create deals table
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    deal_amount NUMERIC(15, 2) DEFAULT 0,
    stage TEXT NOT NULL,
    probability INTEGER DEFAULT 0,
    expected_close_date TIMESTAMP WITH TIME ZONE,
    actual_close_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create deal_contacts junction table
CREATE TABLE IF NOT EXISTS deal_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(deal_id, contact_id)
);

-- Create notes table with vector support
CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES users(id),
    deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
    meeting_date TIMESTAMP WITH TIME ZONE NOT NULL,
    title TEXT NOT NULL,
    note_content TEXT NOT NULL,
    content_vector vector(1536), -- Assuming OpenAI Ada-002 embeddings (1536 dimensions)
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create note_contacts junction table
CREATE TABLE IF NOT EXISTS note_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(note_id, contact_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS contacts_owner_id_idx ON contacts(owner_id);
CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts(email);
CREATE INDEX IF NOT EXISTS deals_owner_id_idx ON deals(owner_id);
CREATE INDEX IF NOT EXISTS deals_stage_idx ON deals(stage);
CREATE INDEX IF NOT EXISTS notes_owner_id_idx ON notes(owner_id);
CREATE INDEX IF NOT EXISTS notes_deal_id_idx ON notes(deal_id);
CREATE INDEX IF NOT EXISTS note_contacts_contact_id_idx ON note_contacts(contact_id);
CREATE INDEX IF NOT EXISTS deal_contacts_contact_id_idx ON deal_contacts(contact_id);

-- Create vector index for note content
CREATE INDEX IF NOT EXISTS notes_content_vector_idx ON notes USING ivfflat (content_vector vector_cosine_ops)
WITH (lists = 100);

-- Create stored procedure for vector search
CREATE OR REPLACE FUNCTION search_notes(
    query_embedding vector(1536),
    match_threshold FLOAT,
    match_count INT,
    p_owner_id UUID DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    owner_id UUID,
    deal_id UUID,
    meeting_date TIMESTAMP WITH TIME ZONE,
    title TEXT,
    note_content TEXT,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        n.id,
        n.owner_id,
        n.deal_id,
        n.meeting_date,
        n.title,
        n.note_content,
        n.created_at,
        n.updated_at,
        1 - (n.content_vector <=> query_embedding) as similarity
    FROM
        notes n
    WHERE
        (p_owner_id IS NULL OR n.owner_id = p_owner_id)
        AND (1 - (n.content_vector <=> query_embedding)) > match_threshold
    ORDER BY
        n.content_vector <=> query_embedding
    LIMIT match_count;
END;
$$;
