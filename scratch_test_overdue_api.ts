async function testApi() {
  try {
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'manager@example.com', password: 'Password123!' })
    });
    const loginData = await loginRes.json();
    console.log('Login result token:', loginData.token ? 'Success' : loginData);

    const remindersRes = await fetch('http://localhost:3000/api/manager/overdue-reminders', {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    const remindersData = await remindersRes.json();
    console.log('Overdue Reminders endpoint result count:', remindersData.count);
    console.log('Sample reminder:', remindersData.reminders?.[0]);
  } catch (err) {
    console.error(err);
  }
}

testApi();
