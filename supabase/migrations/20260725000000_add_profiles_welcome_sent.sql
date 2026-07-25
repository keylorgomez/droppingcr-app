-- Tracks whether the "welcome" email has been sent for a profile, so it fires
-- exactly once regardless of how the account was created (manual signup, Google
-- OAuth, magic link). Needed because a DB trigger pre-creates the profile row on
-- auth.users insert, which made the app's "isNew" check unreliable for OAuth.
alter table profiles add column if not exists welcome_sent boolean not null default false;

-- Existing users have already been onboarded — don't email them retroactively.
-- Only rows inserted after this migration keep the default (false).
update profiles set welcome_sent = true where welcome_sent = false;
