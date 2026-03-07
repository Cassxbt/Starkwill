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
    contract: "vault_factory",
    constructorArgs: {
      vault_class_hash:
        "0x6c31f8391d18439ce128c3a5ac10e88ceabbb8c44290fd4527f07ce1062629a",
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
