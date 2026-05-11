import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://scjldsyvikxsbefhzrua.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNjamxkc3l2aWt4c2JlZmh6cnVhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODIxMjUxMiwiZXhwIjoyMDkzNzg4NTEyfQ.85avUHuSSt089HxVkhjQb5xVK4gpo7lGLM5XWuRssX4';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const TEST_EMAILS = [
  'superadmin@links.com',
  'admin@links.com',
  'ops@links.com',
  'docs@links.com',
  'viewer@links.com',
];

async function listAndConfirm() {
  try {
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Error listing users:', listError);
      return;
    }

    console.log('📋 Supabase Users:\n');
    for (const user of users) {
      const confirmed = user.email_confirmed_at ? '✅' : '❌';
      console.log(`${confirmed} ${user.email}`);

      if (TEST_EMAILS.includes(user.email) && !user.email_confirmed_at) {
        console.log(`   → Confirming email...`);
        const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
          email_confirm: true,
        });

        if (updateError) {
          console.log(`   ❌ Error: ${updateError.message}`);
        } else {
          console.log(`   ✅ Email confirmed!`);
        }
      }
    }
    console.log('\n✨ Done!');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

listAndConfirm();
