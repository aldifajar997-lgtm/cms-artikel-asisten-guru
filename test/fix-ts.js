import fs from 'fs';
import path from 'path';

const dir = './src';
const walk = (d) => {
  const files = fs.readdirSync(d);
  files.forEach(f => {
    const full = path.join(d, f);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (full.endsWith('.ts')) {
      let content = fs.readFileSync(full, 'utf8');
      
      if (content.includes('import { Bindings } from') && !content.includes('Variables')) {
          content = content.replace(/import \{ Bindings \} from/g, "import { Bindings, Variables } from");
      }
      
      content = content.replace(/<\{ Bindings: Bindings \}>/g, "<{ Bindings: Bindings; Variables: Variables }>");
      
      if (full.replace(/\\/g, '/').endsWith('routes/auth.ts') && !content.includes('verifyToken }')) {
          content = content.replace(/generateRefreshToken \} from '\.\.\/utils\/jwt'/, "generateRefreshToken, verifyToken } from '../utils/jwt'");
      }
      
      fs.writeFileSync(full, content);
    }
  });
}
walk(dir);

let jwtContent = fs.readFileSync('./src/utils/jwt.ts', 'utf8');
jwtContent = jwtContent.replace(/verify\(token, secret\)/g, "verify(token, secret, 'HS256')");
fs.writeFileSync('./src/utils/jwt.ts', jwtContent);
