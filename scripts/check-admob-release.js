// Invoked by the generated native Release build phase, using the identifiers
// captured at prebuild time. Environment overrides cannot turn a test binary live.
const { assertProductionIds } = require('../config/admob');
const [appId, bannerId] = process.argv.slice(2);
try {
  assertProductionIds({ appId, bannerId });
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
