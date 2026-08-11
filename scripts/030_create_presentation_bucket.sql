-- Create presentations storage bucket (only needed in Supabase dashboard or via CLI)
-- This is a reference - the bucket should be created via Supabase dashboard:
-- 1. Go to Storage in Supabase dashboard
-- 2. Click "Create a new bucket" and name it "presentations"
-- 3. Set it to "Private" for security
-- 4. Click "Save"

-- Note: This SQL will not work in Supabase SQL editor as storage creation requires the API
-- Instead, use: supabase bucket create presentations --project-ref=<your-project-ref>
