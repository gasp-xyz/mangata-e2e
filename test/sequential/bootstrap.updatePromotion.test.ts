/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group bootstrap
 * @group sequential
 */
import { getApi, initApi } from "../../utils/api";
import {
  scheduleBootstrap,
  finalizeBootstrap,
  updatePromoteBootstrapPool,
  provisionBootstrap,
  claimRewardsBootstrap,
  getLiquidityAssetId,
  getBalanceOfAsset,
} from "../../utils/tx";
import { EventResult, ExtrinsicResult } from "../../utils/eventListeners";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  waitForBootstrapStatus,
} from "../../utils/utils";
import {
  getEventResultFromMangataTx,
  getBalanceOfPool,
  checkSudoOperataionSuccess,
  checkSudoOperataionFail,
} from "../../utils/txHandler";
import {
  checkLastBootstrapFinalized,
  createNewBootstrapCurrency,
  setupBootstrapTokensBalance,
  getPromotionBootstrapPoolState,
} from "../../utils/Bootstrap";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN, MangataGenericEvent } from "@mangata-finance/sdk";
import { setupUsers } from "../../utils/setup";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(3500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let sudo: User;
let keyring: Keyring;
let bootstrapCurrency: any;
let bootstrapPool: any;
let eventResponse: EventResult;

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
//constant for bootstrap include a planning period
const waitingPeriodWithPlan = 400;
//constant for bootstrap less a planning period
const waitingPeriodLessPlan = 10;
const bootstrapPeriod = 20;
const whitelistPeriod = 10;
const bootstrapAmount = new BN(10000000000);

async function changePromotionBootstrapPool(userName: User) {
  const currentPromotingState = await getPromotionBootstrapPoolState();

  const result = await updatePromoteBootstrapPool(
    userName,
    !currentPromotingState
  );

  return result;
}

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  sudo = new User(keyring, sudoUserName);

  [testUser1] = setupUsers();

  await checkLastBootstrapFinalized(sudo);
  bootstrapCurrency = await createNewBootstrapCurrency(sudo);

  await setupBootstrapTokensBalance(bootstrapCurrency, sudo, [testUser1]);
});

test("bootstrap - bootstrap - Check if we can change promoteBootstrapPool in each phase", async () => {
  let checkingUpdatingPool: MangataGenericEvent[];

  const scheduleBootstrapBefPlan = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriodWithPlan,
    bootstrapPeriod,
    whitelistPeriod
  );
  await checkSudoOperataionSuccess(scheduleBootstrapBefPlan);

  checkingUpdatingPool = await changePromotionBootstrapPool(sudo);
  await checkSudoOperataionSuccess(checkingUpdatingPool);

  const scheduleBootstrapAftPlan = await scheduleBootstrap(
    sudo,
    MGA_ASSET_ID,
    bootstrapCurrency,
    waitingPeriodLessPlan,
    bootstrapPeriod,
    whitelistPeriod
  );
  await checkSudoOperataionSuccess(scheduleBootstrapAftPlan);

  checkingUpdatingPool = await changePromotionBootstrapPool(sudo);
  await checkSudoOperataionSuccess(checkingUpdatingPool);

  await waitForBootstrapStatus("Whitelist", waitingPeriodLessPlan);

  checkingUpdatingPool = await changePromotionBootstrapPool(sudo);
  await checkSudoOperataionSuccess(checkingUpdatingPool);

  await waitForBootstrapStatus("Public", waitingPeriodLessPlan);

  checkingUpdatingPool = await changePromotionBootstrapPool(sudo);
  await checkSudoOperataionSuccess(checkingUpdatingPool);

  const provisionPublicBootstrapCurrency = await provisionBootstrap(
    testUser1,
    bootstrapCurrency,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionPublicBootstrapCurrency);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const provisionPublicMGA = await provisionBootstrap(
    testUser1,
    MGA_ASSET_ID,
    bootstrapAmount
  );
  eventResponse = getEventResultFromMangataTx(provisionPublicMGA);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  await waitForBootstrapStatus("Finished", bootstrapPeriod);

  checkingUpdatingPool = await changePromotionBootstrapPool(sudo);
  await checkSudoOperataionFail(checkingUpdatingPool, "BootstrapFinished");

  bootstrapPool = await getBalanceOfPool(MGA_ASSET_ID, bootstrapCurrency);
  const bootstrapPoolBalance = bootstrapPool[0];
  expect(bootstrapPoolBalance[0]).bnEqual(bootstrapAmount);
  expect(bootstrapPoolBalance[1]).bnEqual(bootstrapAmount);
  const bootstrapExpectedUserLiquidity = new BN(
    bootstrapPoolBalance[0].add(bootstrapPoolBalance[1]) / 2
  );

  const claimRewards = await claimRewardsBootstrap(testUser1);
  eventResponse = getEventResultFromMangataTx(claimRewards);
  expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

  const liquidityID = await getLiquidityAssetId(
    MGA_ASSET_ID,
    bootstrapCurrency
  );

  const userBalance = await getBalanceOfAsset(
    liquidityID,
    testUser1.keyRingPair.address.toString()
  );

  const currentPromotionState = await getPromotionBootstrapPoolState();

  if (currentPromotionState) {
    expect(userBalance.free).bnEqual(bootstrapExpectedUserLiquidity);
    expect(userBalance.frozen).bnEqual(new BN(0));
  } else {
    expect(userBalance.free).bnEqual(new BN(0));
    expect(userBalance.frozen).bnEqual(bootstrapExpectedUserLiquidity);
  }

  const bootstrapFinalize = await finalizeBootstrap(sudo);
  await checkSudoOperataionSuccess(bootstrapFinalize);

  await checkLastBootstrapFinalized(sudo);
});
