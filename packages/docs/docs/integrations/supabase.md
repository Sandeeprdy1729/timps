---
id: supabase
title: Supabase Integration
description: Complete guide to integrating TIMPS with Supabase for backend services.
---

# Supabase Integration

TIMPS integrates with Supabase for database, auth, and realtime.

## Configuration

```bash
SUPABASE_URL=https://project.supabase.co
SUPABASE_KEY=your-anon-key
```

## Usage

### Database

```typescript
import { SupabaseIntegration } from '@timps/integrations';

const supabase = new SupabaseIntegration({
  url: process.env.SUPABASE_URL,
  key: process.env.SUPABASE_KEY,
});

await supabase.connect();

// Select
const { data, error } = await supabase
  .from('users')
  .select('*');

// Insert
const { data, error } = await supabase
  .from('users')
  .insert({ email: 'test@example.com' });

// Update
const { data, error } = await supabase
  .from('users')
  .update({ name: 'Updated' })
  .eq('id', '1');

// Delete
const { data, error } = await supabase
  .from('users')
  .delete()
  .eq('id', '1');
```

### Auth

```typescript
// Sign up
const { user, session } = await supabase.auth.signUp({
  email: 'test@example.com',
  password: 'password',
});

// Sign in
const { user, session } = await supabase.auth.signInWithPassword({
  email: 'test@example.com',
  password: 'password',
});

// Sign out
await supabase.auth.signOut();
```

### Realtime

```typescript
const channel = supabase
  .channel('table:users')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, (payload) => {
    console.log(payload);
  })
  .subscribe();
```