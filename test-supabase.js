import fs from "fs";

const botEnvPath = "/Users/asil/.gemini/antigravity/scratch/.env";
const envVars = {};
if (fs.existsSync(botEnvPath)) {
  const content = fs.readFileSync(botEnvPath, "utf8");
  content.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match) {
      envVars[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  });
}

const SUPABASE_URL = envVars["SUPABASE_URL"];
const SUPABASE_KEY = envVars["SUPABASE_KEY"];

const tables = ["bot_actions", "web_actions", "actions", "history", "action_logs", "bot_history"];

async function probeTables() {
  for (const t of tables) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${t}?select=*&limit=1`, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      });
      console.log(`Table '${t}': Status ${res.status}`);
      if (res.ok) {
        console.log(`  -> SUCCESS! Table '${t}' exists! Data preview:`, await res.json());
      } else {
        console.log(`  -> Response:`, await res.text());
      }
    } catch (e) {
      console.log(`Table '${t}': Error:`, e.message);
    }
  }
}

probeTables();
