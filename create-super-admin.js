// create-super-admin.js
const bcrypt = require('bcryptjs');

async function generateHash() {
  const password = 'Admin@123'; // Change this to your desired password
  const hash = await bcrypt.hash(password, 10);
  console.log('Password:', password);
  console.log('Hash:', hash);
}

generateHash();