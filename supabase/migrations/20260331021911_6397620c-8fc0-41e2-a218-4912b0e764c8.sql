
-- Add branches JSON column to conversations table
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS branches jsonb DEFAULT '[]'::jsonb;

-- Add branch_id column to messages table  
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS branch_id text DEFAULT 'main';
