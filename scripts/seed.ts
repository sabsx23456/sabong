import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load usage of .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing Supabase environment variables in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedAdmin() {
    // Use a different username/email to avoid potential conflicts if 'admin' already exists in profiles
    const email = 'admin_super@sabong.com';
    const password = 'password123';
    const username = 'admin_super';

    console.log(`Attempting to create Admin user: ${email}...`);

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                username: username,
                role: 'admin',
            },
        },
    });

    if (error) {
        console.error('Error creating admin:', error.message);
        if (error.message.includes('Database error')) {
            console.error('HINT: This usually means the "handle_new_user" trigger failed.');
            console.error('Possible causes:');
            console.error('1. You did not run the schema.sql in Supabase.');
            console.error('2. The "profiles" table does not exist.');
            console.error('3. The username "admin_super" is already taken.');
        }
        return;
    }

    console.log('Admin account created successfully!');
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log('User ID:', data.user?.id);
    console.log('NOTE: If email confirmation is enabled in your Supabase project, you must confirm the email before logging in.');

    // Verify Login
    console.log('Verifying login...');
    const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (signInError) {
        console.error('❌ Verification Failed:', signInError.message);
        if (signInError.message.includes('Email not confirmed')) {
            console.error('CRITICAL: You need to go to Supabase Dashboard -> Authentication -> Providers -> Email -> Disable "Confirm email" or manually confirm this user in the "Users" table.');
        }
    } else {
        console.log('✅ verification Successful! You can log in now.');
    }
}

seedAdmin();
