const fs = require("fs");

module.exports = (message) => {
  const time = new Date().toISOString();
  const logMessage = `[${time}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync("bot_logs.txt", logMessage + "\n");
};