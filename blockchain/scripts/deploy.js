// GovChain - Stage 2.1
// Deployment script for the GovChain audit contract.
//
// A local Hardhat node must be running before deploying:
//   terminal 1:  npm run node
//   terminal 2:  npm run deploy
//
// It deploys GovChain.sol, prints the network/deployer/contract information and
// writes a deployment artifact that later modules can read.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { network } from "hardhat";

const CONTRACT_NAME = "GovChain";
const LOCAL_RPC_URL = "http://127.0.0.1:8545";
const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEPLOYMENTS_DIRECTORY = path.join(SCRIPT_DIRECTORY, "..", "deployments");

async function main() {
  // Connects to the network selected with `--network` (see the `deploy` script in
  // package.json) and exposes the ethers helpers provided by hardhat-ethers.
  const { ethers, networkName } = await network.create();

  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const { chainId } = await ethers.provider.getNetwork();

  console.log("================================");
  console.log("GovChain Blockchain Deployment");
  console.log("================================");
  console.log();
  console.log(`Network: ${networkName}`);
  console.log(`Chain ID: ${chainId}`);
  console.log(`Deployer: ${deployerAddress}`);
  console.log();
  console.log(`Deploying ${CONTRACT_NAME}...`);

  const govChain = await ethers.deployContract(CONTRACT_NAME);
  const deploymentTransaction = govChain.deploymentTransaction();

  await govChain.waitForDeployment();

  const contractAddress = await govChain.getAddress();
  const contractVersion = await govChain.contractVersion();
  const blockNumber = await ethers.provider.getBlockNumber();

  console.log();
  console.log(`${CONTRACT_NAME} Contract: ${contractAddress}`);
  console.log(`Contract version: ${contractVersion}`);
  console.log();

  const deployment = {
    stage: "2.1",
    contractName: CONTRACT_NAME,
    contractVersion,
    network: networkName,
    chainId: Number(chainId),
    rpcUrl: networkName === "localhost" ? LOCAL_RPC_URL : null,
    address: contractAddress,
    deployer: deployerAddress,
    transactionHash: deploymentTransaction?.hash ?? null,
    blockNumber,
    deployedAt: new Date().toISOString(),
  };

  const artifactPath = await writeDeploymentArtifact(networkName, deployment);

  console.log(`Deployment artifact: ${artifactPath}`);
  console.log();
  console.log("Next step: set GOVCHAIN_CONTRACT_ADDRESS in server/.env to the address above");
  console.log("so the Express backend can record GovChain events on this contract.");
  console.log();
  console.log("Deployment complete.");
}

// Writes deployments/<network>.json so later modules can reuse the address.
async function writeDeploymentArtifact(networkName, deployment) {
  const artifactPath = path.join(DEPLOYMENTS_DIRECTORY, `${networkName}.json`);

  await mkdir(DEPLOYMENTS_DIRECTORY, { recursive: true });
  await writeFile(
    artifactPath,
    `${JSON.stringify(deployment, null, 2)}\n`,
    "utf8",
  );

  return artifactPath;
}

main().catch((error) => {
  console.error();
  console.error("GovChain deployment failed.");
  console.error(error);
  console.error();
  console.error(
    "If this is a connection error, make sure the local Hardhat node is running:",
  );
  console.error("  npm run node");
  process.exitCode = 1;
});
