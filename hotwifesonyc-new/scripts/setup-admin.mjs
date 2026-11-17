import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { setupAdmin } from '../lib/auth.mjs';
import { dataDirectory } from '../lib/store.mjs';
const generate = process.argv.includes('--generate');
const input = generate ? null : createInterface({input:process.stdin,output:process.stdout});
try {
  const password = generate ? randomBytes(24).toString('base64url') : await input.question('New admin password (16+ characters; local terminal input is visible): ');
  await setupAdmin(password,process.argv.includes('--reset'));
  if(generate) { const file=join(dataDirectory(),'initial-password.txt'); await writeFile(file,password+'\n',{mode:0o600}); console.log('Admin configured. Initial password is in .local/initial-password.txt (private, ignored by Git).'); }
  else console.log('Admin configured. Previous sessions are invalid after a reset.');
} finally { input?.close(); }
