const blockchainService = require('../services/blockchain.service');

// GET /api/blockchain/status — any authenticated user (Stage 2.5).
//
// Live blockchain health: the service never throws, so a chain that is switched
// off or unreachable is returned as a normal 200 response with
// connected:false — an application-level fact, not a server error. The response
// never contains the private key, the RPC credentials or any other secret.
async function getBlockchainStatus(req, res) {
  try {
    const status = await blockchainService.getBlockchainStatus();
    return res.json(status);
  } catch (error) {
    console.error(`[blockchain/status] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getBlockchainStatus };