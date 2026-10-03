const { execSync } = require('node:child_process');
try {
    const out = execSync('tmux -V', { encoding: 'utf-8' });
    console.log('tmux -V:', out.trim());
} catch (e) {
    console.error('Error:', e.message);
}
