
-- Sessions table for Imagine To Code
CREATE TABLE public.imagine_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Untitled Session',
  pixels jsonb NOT NULL DEFAULT '[]'::jsonb,
  grid_w integer NOT NULL DEFAULT 64,
  grid_h integer NOT NULL DEFAULT 64,
  aureon_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.imagine_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users CRUD own imagine_sessions"
  ON public.imagine_sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_imagine_sessions_updated_at
  BEFORE UPDATE ON public.imagine_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
