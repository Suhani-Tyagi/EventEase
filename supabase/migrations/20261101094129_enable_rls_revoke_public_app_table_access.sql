-- Keep application tables inaccessible to Supabase's direct client API roles.
-- The server-side application uses its database connection to access these tables.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_plans ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
    public.users,
    public.user_sessions,
    public.event_plans
FROM anon, authenticated;
