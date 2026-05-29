import fs from "fs";

const webEnvPath = "/Users/asil/Documents/vs-code/web_lokmaco3/.env";
const envVars = {};
if (fs.existsSync(webEnvPath)) {
  const content = fs.readFileSync(webEnvPath, "utf8");
  content.split("\n").forEach((line) => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (match) {
      envVars[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  });
}

process.env.IIKO_SERVER = envVars["IIKO_SERVER"];
process.env.IIKO_LOGIN = envVars["IIKO_LOGIN"];
process.env.IIKO_PASSWORD = envVars["IIKO_PASSWORD"];

const { withIikoSession, iikoGetJson, iikoGetRaw } = await import("./lib/iiko.js");

const endpoints = [
  "v2/entities/measurementUnits",
  "measurementUnits",
  "corporation/measurementUnits",
  "v2/entities/units"
];

async function probe() {
  await withIikoSession(async (token) => {
    for (const ep of endpoints) {
      console.log(`Probing: /resto/api/${ep}...`);
      try {
        const raw = await iikoGetRaw(ep, token);
        console.log(`  -> Status:`, raw ? "OK!" : "Failed");
        if (raw) {
          console.log(`  -> Content snippet:`, raw.slice(0, 500));
          return;
        }
      } catch (e) {
        console.log(`  -> Error:`, e.message);
      }
    }
  });
}

probe();
