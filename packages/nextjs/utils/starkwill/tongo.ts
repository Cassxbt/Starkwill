import { TONGO_CONTRACTS, TONGO_SUPPORTED_TOKENS } from "./tongo-constants";
import type { Call } from "starknet";

export { TONGO_CONTRACTS, TONGO_SUPPORTED_TOKENS };

const SEPOLIA_RPC = "https://starknet-sepolia.public.blastapi.io/rpc/v0_7";

/**
 * Dynamically import the Tongo SDK and starknet RpcProvider.
 * Avoids webpack trying to process the SDK's broken .ts source references at build time.
 */
async function loadTongoDeps() {
  const [{ Account }, { RpcProvider }] = await Promise.all([
    import(/* webpackIgnore: true */ "@fatsolutions/tongo-sdk"),
    import("starknet"),
  ]);
  return { Account, RpcProvider };
}

/**
 * Step 1: Fund Tongo — moves ERC20 from user's wallet into encrypted Tongo balance.
 * Returns the Call[] to execute via the user's wallet.
 */
export async function buildFundCalls(
  tongoPrivateKey: string,
  tokenSymbol: string,
  amount: bigint,
  senderAddress: string,
): Promise<Call[]> {
  const { Account, RpcProvider } = await loadTongoDeps();
  const contractAddr = TONGO_CONTRACTS[tokenSymbol];
  if (!contractAddr) throw new Error(`No Tongo contract for ${tokenSymbol}`);
  const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });
  const tongoAccount = new Account(tongoPrivateKey, contractAddr, provider as any);

  const fundOp = await tongoAccount.fund({ amount, sender: senderAddress });
  const calls: Call[] = [];
  if (fundOp.approve) calls.push(fundOp.approve);
  calls.push(fundOp.toCalldata());
  return calls;
}

/**
 * Step 2: Withdraw from Tongo to vault — converts encrypted balance back to ERC20 and sends to vault.
 * Returns the Call[] to execute via the user's wallet.
 */
export async function buildWithdrawCalls(
  tongoPrivateKey: string,
  tokenSymbol: string,
  amount: bigint,
  vaultAddress: string,
  senderAddress: string,
): Promise<Call[]> {
  const { Account, RpcProvider } = await loadTongoDeps();
  const contractAddr = TONGO_CONTRACTS[tokenSymbol];
  if (!contractAddr) throw new Error(`No Tongo contract for ${tokenSymbol}`);
  const provider = new RpcProvider({ nodeUrl: SEPOLIA_RPC });
  const tongoAccount = new Account(tongoPrivateKey, contractAddr, provider as any);

  const withdrawOp = await tongoAccount.withdraw({
    amount,
    to: vaultAddress,
    sender: senderAddress,
  });
  return [withdrawOp.toCalldata()];
}
