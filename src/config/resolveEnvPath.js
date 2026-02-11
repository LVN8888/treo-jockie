const path = require("path");

module.exports = () => {
  const args = process.argv.slice(2);
  const flagIndex = args.findIndex(arg => ["--env", "-e", "--config", "--configs"].includes(arg));
  
  let envFile = process.env.ENV_FILE || process.env.CONFIG_FILE || process.env.CONFIG;

  if (flagIndex !== -1 && args[flagIndex + 1]) {
    envFile = args[flagIndex + 1];
  }

  if (!envFile) return path.join(process.cwd(), ".env");
  return path.isAbsolute(envFile) ? envFile : path.join(process.cwd(), envFile);
};