import { createClient } from '@supabase/supabase-js'

// The mobile prototype talks to Supabase directly with the anon key.
// Anon keys are designed to be public — but only when Row Level Security is on.
export const supabase = createClient(
  'https://xyzcompany.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMH0.FAKE-anon-key-for-training-do-not-use',
)
