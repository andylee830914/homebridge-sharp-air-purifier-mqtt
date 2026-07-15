const {
  PLUGIN_NAME,
  PLATFORM_NAME,
  SharpAirPurifierPlatform,
} = require("./src/platform");

module.exports = (api) => {
  api.registerPlatform(PLUGIN_NAME, PLATFORM_NAME, SharpAirPurifierPlatform);
};
