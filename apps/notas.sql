-- Arquivo: apps/notas.sql

CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title VARCHAR(255) DEFAULT 'Sem título',
    content TEXT DEFAULT '',
    is_archived BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índice para agilizar a busca de notas por usuário
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
