async function testProducts() {
  try {
    const res = await fetch('http://localhost:3000/api/health');
    console.log('Health check:', await res.json());

    // We can also test seeding products directly on the running process if needed
  } catch (err) {
    console.error('Error fetching health:', err);
  }
}

testProducts();
