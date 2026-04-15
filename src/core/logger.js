module.exports = (message) => {
  const time = new Date().toLocaleString('sv-SE');
  const logMessage = `[${time}] ${message}`;
  console.log(logMessage);
};