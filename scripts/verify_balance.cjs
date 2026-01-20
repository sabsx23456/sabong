
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pijlzehqcootdwuxtrlx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBpamx6ZWhxY29vdGR3dXh0cmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0ODQ0NzIsImV4cCI6MjA4NDA2MDQ3Mn0.v7QTcgYVSgJ9QASM2fFizncMnimXGU3XYjPTAGBUg3M';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyBalance() {
    console.log("Starting verification...");

    // 1. Login as Admin
    console.log("Logging in as admin...");
    const { data: { session }, error: loginError } = await supabase.auth.signInWithPassword({
        email: 'admin@example.com',
        password: 'password123'
    });

    if (loginError) {
        console.error("Login failed:", loginError);
        return;
    }
    console.log("Login successful. User:", session.user.email);

    // 2. Fetch a user to update
    const { data: users, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .not('email', 'eq', 'admin@gmail.com')
        .limit(1);

    if (fetchError || !users.length) {
        console.error("Fetch users failed or no users found:", fetchError);
        return;
    }

    const targetUser = users[0];
    const initialBalance = Number(targetUser.balance) || 0;
    console.log(`Target User: ${targetUser.username}, Initial Balance: ${initialBalance}`);

    // 3. Update Balance
    const addAmount = 50;
    const newExpectedBalance = initialBalance + addAmount;
    console.log(`Attempting to add ${addAmount}... Expected: ${newExpectedBalance}`);

    const { error: updateError } = await supabase
        .from('profiles')
        .update({ balance: newExpectedBalance })
        .eq('id', targetUser.id);

    if (updateError) {
        console.error("Update failed:", updateError);
        return;
    }
    console.log("Update command sent successfully.");

    // 4. Verification Fetch
    // Wait small delay
    await new Promise(r => setTimeout(r, 1000));

    const { data: updatedUser, error: verifyError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUser.id)
        .single();

    if (verifyError) {
        console.error("Verification fetch failed:", verifyError);
        return;
    }

    const finalBalance = Number(updatedUser.balance);
    console.log(`Final Balance: ${finalBalance}`);

    if (finalBalance === newExpectedBalance) {
        console.log("SUCCESS: Balance updated correctly.");
    } else {
        console.error(`FAILURE: Balance mismatch. Expected ${newExpectedBalance}, got ${finalBalance}`);
    }
}

verifyBalance();
