const net = require("net");
const fs = require("fs");
const path = require("path");

const LOG_FILE = path.join(__dirname, "host.log");

function log(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

log("Host script started");

// Define the port we will communicate with Electron on
const PORT = 33445;
const HOST = "127.0.0.1";

// Create a socket connection to the Electron app
const client = new net.Socket();

client.connect(PORT, HOST, () => {
  log("Connected to Electron TCP server");
  // Pipe stdin (from Chrome) directly to the socket (to Electron)
  process.stdin.pipe(client);
  // Pipe socket (from Electron) directly to stdout (to Chrome)
  client.pipe(process.stdout);
});

client.on("error", (err) => {
  log(`Socket error: ${err.message}`);
  process.exit(1);
});

client.on("close", () => {
  log("Socket closed");
  process.exit(0);
});

process.stdin.on("end", () => {
  log("Stdin ended");
  client.end();
});
