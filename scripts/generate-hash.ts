import { hashPassword } from '../src/utils/password';

async function main() {
  const password = '1qaz2wsx';
  const hash = await hashPassword(password);
  console.log('Password hash for 1qaz2wsx:');
  console.log(hash);
}

main().catch(console.error);
