// Steadfast courier adapter - HONEST STUB, not a real implementation.
//
// This business does not yet have verified, current Steadfast API
// documentation or real credentials. Rather than fabricating a
// plausible-looking-but-wrong API request/response shape from uncertain
// memory (which would be actively dangerous once real credentials are added
// - it could silently mis-ship real customer packages), every function below
// throws a clear "not implemented" error instead.
//
// To implement this for real:
//   1. Obtain Steadfast's official, current merchant API documentation.
//   2. Set the env vars this file checks for (placeholders below - rename
//      as needed to match Steadfast's actual auth model).
//   3. Replace the throw in each function with a real, verified API call
//      that implements the exact interface documented in ./index.js.

function hasCredentials() {
  return Boolean(process.env.STEADFAST_API_KEY && process.env.STEADFAST_SECRET_KEY);
}

const NOT_IMPLEMENTED_MESSAGE =
  'Steadfast courier integration is not implemented yet. This adapter is a placeholder - implement real API calls here once you have Steadfast\'s API documentation and have verified the request/response shapes. See server/src/lib/courier/mockAdapter.js for the interface this must implement.';

async function createShipment(_params) {
  hasCredentials(); // presence checked for future use; not implemented regardless
  throw new Error(NOT_IMPLEMENTED_MESSAGE);
}

async function getStatus(_trackingNumber) {
  hasCredentials();
  throw new Error(NOT_IMPLEMENTED_MESSAGE);
}

async function cancelShipment(_trackingNumber) {
  hasCredentials();
  throw new Error(NOT_IMPLEMENTED_MESSAGE);
}

module.exports = { createShipment, getStatus, cancelShipment };
