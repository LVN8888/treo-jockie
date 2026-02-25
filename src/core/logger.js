module.exports = (message) => {
  const time = new Date().toISOString();
  const logMessage = `[${time}] ${message}`;
  console.log(logMessage);
};