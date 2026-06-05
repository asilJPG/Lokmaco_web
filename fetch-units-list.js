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

const { withIikoSession, iikoGetJson: _iikoGetJson, iikoGetRaw } = await import("./lib/iiko.js");

const endpoints = [
  "v2/entities/measurementUnits",
  "measurementUnits",
  "corporation/measurementUnits",
  "v2/entities/units"
];

async function probe() {
  await withIikoSession(async (token) => {
    for (const ep of endpoints) {
      try {
        const raw = await iikoGetRaw(ep, token);
        console.error(`  -> Status:`, raw ? "OK!" : "Failed");
        if (raw) {
          return;
        }
      } catch (e) {
        console.error(`  -> Error:`, e.message);
      }
    }
  });
}

probe();
