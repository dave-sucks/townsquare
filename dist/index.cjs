const { execSync } = require("child_process");
const { spawn } = require("child_process");

const child = spawn("npx", ["next", "start", "-p", process.env.PORT || "5000"], {
  cwd: __dirname + "/..",
  stdio: "inherit",
  env: { ...process.env },
});

child.on("exit", (code) => {
  process.exit(code);
});
