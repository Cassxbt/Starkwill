import {
  deployContract,
  executeDeployCalls,
  exportDeployments,
  deployer,
  assertDeployerDefined,
  assertRpcNetworkActive,
  assertDeployerSignable,
} from "./deploy-contract";
import { green, red } from "./helpers/colorize-log";

const deployScript = async (): Promise<void> => {
  await deployContract({
    contract: "vault",
    constructorArgs: {
      owner: deployer.address,
      checkin_period_secs: 60, // 1 minute (short for demo)
      grace_period_secs: 60, // 1 minute (short for demo)
      cancelable_until_ts: Math.floor(Date.now() / 1000) + 31536000, // 1 year
      guardian_1: deployer.address,
      guardian_2: "0x0000000000000000000000000000000000000000000000000000000000000001",
      guardian_3: "0x0000000000000000000000000000000000000000000000000000000000000002",
    },
  });
};

const main = async (): Promise<void> => {
  try {
    assertDeployerDefined();

    await Promise.all([assertRpcNetworkActive(), assertDeployerSignable()]);

    await deployScript();
    await executeDeployCalls();
    exportDeployments();

    console.log(green("All Setup Done!"));
  } catch (err) {
    if (err instanceof Error) {
      console.error(red(err.message));
    } else {
      console.error(err);
    }
    process.exit(1);
  }
};

main();
