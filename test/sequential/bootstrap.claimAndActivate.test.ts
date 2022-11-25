/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group bootstrap
 * @group sequential
 */
import { getApi, initApi } from "../../utils/api";
import {
  scheduleBootstrap,
  provisionBootstrap,
  provisionVestedBootstrap,
  getLiquidityAssetId,
  claimAndActivateBootstrap,
  promotePool,
  vestingTransfer,
} from "../../utils/tx";
import { EventResult, ExtrinsicResult } from "../../utils/eventListeners";
import { Keyring } from "@polkadot/api";
import { User } from "../../utils/User";
import {
  getEnvironmentRequiredVars,
  getBlockNumber,
  waitForBootstrapStatus,
} from "../../utils/utils";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { MGA_ASSET_ID } from "../../utils/Constants";
import { BN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import {
  checkLastBootstrapFinalized,
  createNewBootstrapCurrency,
  setupBootstrapTokensBalance,
} from "../../utils/Bootstrap";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.spyOn(console, "error").mockImplementation(jest.fn());
jest.setTimeout(3500000);
process.env.NODE_ENV = "test";

let testUser1: User;
let testUser2: User;
let sudo: User;
let keyring: Keyring;
let bootstrapPhase: any;
let bootstrapCurrency: any;
let bootstrapPool: any;
let eventResponse: EventResult;

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
const waitingPeriod = 15;
const bootstrapPeriod = 30;
const bootstrapAmount = new BN(10000000000);

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }

  keyring = new Keyring({ type: "sr25519" });

  sudo = new User(keyring, sudoUserName);
  keyring.addPair(sudo.keyRingPair);
});

describe.each`
  promoting | vesting
  ${true}   | ${false}
  ${false}  | ${false}
`(
  //deleted combination ${false}  | ${true}
  "bootstrap - checking bootstrapped pool in different situations",
  ({ promoting, vesting }) => {
    beforeEach(async () => {
      await checkLastBootstrapFinalized(sudo);
      bootstrapCurrency = await createNewBootstrapCurrency(sudo);

      [testUser1, testUser2] = setupUsers();

      await setupBootstrapTokensBalance(bootstrapCurrency, sudo, [
        testUser1,
        testUser2,
      ]);
    });

    test(
      "bootstrap - checking claiming and activating rewards. Promoting pool is " +
        promoting.toString() +
        ", vesting MGA token for User1 is " +
        vesting.toString(),
      async () => {
        const api = getApi();
        await setupApi();

        if (vesting === true) {
          const bootstrapBlockNumber = (await getBlockNumber()) + 5;
          const vestingUser = await vestingTransfer(
            sudo,
            MGA_ASSET_ID,
            sudo,
            testUser1,
            bootstrapBlockNumber
          );
          eventResponse = getEventResultFromMangataTx(vestingUser);
          expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        }

        const sudoBootstrap = await scheduleBootstrap(
          sudo,
          MGA_ASSET_ID,
          bootstrapCurrency,
          waitingPeriod,
          bootstrapPeriod
        );
        eventResponse = getEventResultFromMangataTx(sudoBootstrap);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

        await waitForBootstrapStatus("Public", waitingPeriod);

        bootstrapPhase = await api.query.bootstrap.phase();
        expect(bootstrapPhase.toString()).toEqual("Public");

        // provision from User1
        const provisionBTUser1 = await provisionBootstrap(
          testUser1,
          bootstrapCurrency,
          bootstrapAmount
        );
        eventResponse = getEventResultFromMangataTx(provisionBTUser1);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        if (vesting === true) {
          const provisionMGAUser1 = await provisionVestedBootstrap(
            testUser1,
            MGA_ASSET_ID,
            bootstrapAmount
          );
          eventResponse = getEventResultFromMangataTx(provisionMGAUser1);
          expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        } else {
          const provisionMGAUser1 = await provisionBootstrap(
            testUser1,
            MGA_ASSET_ID,
            bootstrapAmount
          );
          eventResponse = getEventResultFromMangataTx(provisionMGAUser1);
          expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        }

        // provision from User2
        const provisionBTUser2 = await provisionBootstrap(
          testUser2,
          bootstrapCurrency,
          bootstrapAmount
        );
        eventResponse = getEventResultFromMangataTx(provisionBTUser2);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        const provisionMGAUser2 = await provisionBootstrap(
          testUser2,
          MGA_ASSET_ID,
          bootstrapAmount
        );
        eventResponse = getEventResultFromMangataTx(provisionMGAUser2);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

        await waitForBootstrapStatus("Finished", bootstrapPeriod);

        const bootstrapAmountPool = bootstrapAmount.muln(2);
        bootstrapPool = await api.query.xyk.pools([
          MGA_ASSET_ID,
          bootstrapCurrency,
        ]);
        expect(bootstrapPool[0]).bnEqual(bootstrapAmountPool);
        expect(bootstrapPool[1]).bnEqual(bootstrapAmountPool);
        const bootstrapExpectedUserLiquidity = new BN(
          bootstrapPool[0].add(bootstrapPool[1]) / 4
        );

        const liquidityID = await getLiquidityAssetId(
          MGA_ASSET_ID,
          bootstrapCurrency
        );

        if (promoting === true) {
          const promotingPool = await promotePool(
            sudo.keyRingPair,
            liquidityID
          );
          eventResponse = getEventResultFromMangataTx(promotingPool);
          expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
        }

        const claimAndActivate1 = await claimAndActivateBootstrap(testUser1);
        eventResponse = getEventResultFromMangataTx(claimAndActivate1);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

        const claimAndActivate2 = await claimAndActivateBootstrap(testUser2);
        eventResponse = getEventResultFromMangataTx(claimAndActivate2);
        expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);

        // finalaze bootstrap
        await checkLastBootstrapFinalized(sudo);

        const bootstrapUser1Liquidity = await api.query.tokens.accounts(
          testUser1.keyRingPair.address,
          liquidityID
        );

        const bootstrapUser2Liquidity = await api.query.tokens.accounts(
          testUser2.keyRingPair.address,
          liquidityID
        );

        if (promoting === true) {
          expect(bootstrapUser1Liquidity.free).bnEqual(new BN(0));
          expect(bootstrapUser1Liquidity.reserved).bnEqual(
            bootstrapExpectedUserLiquidity
          );
          expect(bootstrapUser2Liquidity.free).bnEqual(new BN(0));
          expect(bootstrapUser2Liquidity.reserved).bnEqual(
            bootstrapExpectedUserLiquidity
          );
        } else {
          expect(bootstrapUser1Liquidity.reserved).bnEqual(new BN(0));
          expect(bootstrapUser1Liquidity.free).bnEqual(
            bootstrapExpectedUserLiquidity
          );
          expect(bootstrapUser2Liquidity.reserved).bnEqual(new BN(0));
          expect(bootstrapUser2Liquidity.free).bnEqual(
            bootstrapExpectedUserLiquidity
          );
        }
        if (vesting === true) {
          expect(bootstrapUser1Liquidity.frozen).bnGt(new BN(0));
          expect(bootstrapUser2Liquidity.frozen).bnEqual(new BN(0));
        } else {
          expect(bootstrapUser1Liquidity.frozen).bnEqual(new BN(0));
          expect(bootstrapUser2Liquidity.frozen).bnEqual(new BN(0));
        }
      }
    );
  }
);
