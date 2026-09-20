// Pure helper shared by client and server code: parses a comma-separated
// list of e-mails (e.g. "diego@vizinn.com, outro@vizinn.com") into a
// normalized array. Kept free of process.env access so it's safe to import
// from both client and server modules.
export function parseEmailList(value) {
  return (value || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
