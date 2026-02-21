const { execSync } = require('child_process');
try {
  execSync('rm -rf .next/lock', { stdio: 'inherit' });
  execSync('npx next build', { stdio: 'inherit' });
  execSync('npx next start -p 5000', { stdio: 'inherit' });
} catch (e) {
  process.exit(1);
}
