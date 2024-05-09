/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group maintenance
 */
import { jest } from "@jest/globals";
import { getApi, initApi } from "../../utils/api";
import {
  ExtrinsicResult,
  expectMGAExtrinsicSuDidSuccess,
  EventResult,
} from "../../utils/eventListeners";
import { BN } from "@polkadot/util";
import {
  setupApi,
  Extrinsic,
  setupUsers,
  setupAsEthTokens,
  setupUsersWithBalances,
  getSudoUser,
} from "../../utils/setup";
import {
  getEventErrorFromSudo,
  getEventResultFromMangataTx,
} from "../../utils/txHandler";
import { BN_HUNDRED, signTx } from "@mangata-finance/sdk";
import { FOUNDATION_ADDRESS_1, MGA_ASSET_ID } from "../../utils/Constants";
import { Sudo } from "../../utils/sudo";
import { ApiPromise } from "@polkadot/api";
import { Assets } from "../../utils/Assets";
import {
  AggregatorOptions,
  Staking,
  tokenOriginEnum,
} from "../../utils/Staking";
import { Maintenance } from "../../utils/Maintenance";
import { User } from "../../utils/User";
import { L2Update, Rolldown } from "../../utils/rollDown/Rolldown";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import { SudoDB } from "../../utils/SudoDB";
import { RollDown, rolldownWithdraw } from "../../utils/rolldown";
import { testLog } from "../../utils/Logger";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(1500000);

const users: User[] = [];
let api: ApiPromise;
let tests: { [K: string]: [Extrinsic, User] } = {};
let testUser1: User;
let sequencer: User;
let testUser2: User;
let minStk: BN;
const foundationAccountAddress = FOUNDATION_ADDRESS_1;

describe("On Maintenance mode - regular l1 updates must be forbidden", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    sequencer = await SequencerStaking.getSequencerUser();
    users.push(...setupUsers());
    users.push(sequencer);

    api = await getApi();
    const tokenIds = await SudoDB.getInstance().getTokenIds(1);
    const [token] = await setupAsEthTokens(tokenIds);
    const tokenAddress = JSON.parse(token.toString()).ethereum;
    await setupUsersWithBalances(users, tokenIds.concat([MGA_ASSET_ID]));
    tests = {
      updateL2fromL1: [
        new L2Update(api)
          .withDeposit(
            await Rolldown.l2OriginRequestId(),
            users[0].keyRingPair.address,
            users[0].keyRingPair.address,
            BN_HUNDRED,
          )
          .build(),
        sequencer,
      ],
      withdraw: [
        await rolldownWithdraw(users[0], BN_HUNDRED, tokenAddress.toString()),
        users[0],
      ],
      cancelRequestsFromL1: [
        await RollDown.cancelRequestsFromL1(123, false),
        sequencer,
      ],
      forceCancelRequestsFromL1: [
        Sudo.sudo(await RollDown.cancelRequestsFromL1(123, true)),
        getSudoUser(),
      ],
      forceUpdateL2fromL1: [
        Sudo.sudo(
          new L2Update(api)
            .withDeposit(
              await Rolldown.l2OriginRequestId(),
              users[0].keyRingPair.address,
              users[0].keyRingPair.address,
              BN_HUNDRED,
            )
            .forceBuild(),
        ),
        getSudoUser(),
      ],
    };
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(
        foundationAccountAddress,
        Maintenance.switchMaintenanceModeOff(),
      ),
    );
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(
        foundationAccountAddress,
        Maintenance.switchMaintenanceModeOn(),
      ),
    ).then((value) => {
      expectMGAExtrinsicSuDidSuccess(value);
    });
  });
  it.each([
    "updateL2fromL1",
    "withdraw",
    "cancelRequestsFromL1",
    "forceCancelRequestsFromL1",
    "forceUpdateL2fromL1",
  ])("%s operation is not allowed in mm", async (testName) => {
    const [extrinsic, signer] = tests[testName];
    if (testName === "updateL2fromL1") {
      await Rolldown.waitForReadRights(signer.toString());
    }
    await signTx(api, extrinsic, signer.keyRingPair)
      .then(async (events) => {
        let event: EventResult;
        try {
          event = getEventResultFromMangataTx(events, [
            "system",
            "ExtrinsicFailed",
          ]);
        } catch (e) {
          testLog.getLog().info("Perhaps a sudo event" + e);
          event = await getEventErrorFromSudo(events);
        }
        expect(event.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
        expect(event.data).toContain("BlockedByMaintenanceMode");
      })
      .catch((exc) => {
        testLog.getLog().error(exc);

        expect(JSON.parse(JSON.stringify(exc)).data.toString()).toContain(
          "1010: Invalid Transaction: The swap prevalidation has failed",
        );
      });
  });
});
describe.skip("On Maintenance mode - sequencing and force updates are allowed", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    [testUser1, testUser2] = setupUsers();
    await setupApi();
    minStk = new BN(
      (await getApi()).consts.parachainStaking.minCandidateStk.toString(),
    );
    await Sudo.batchAsSudoFinalized(
      Assets.mintNative(testUser1, minStk.muln(1000)),
      Assets.mintNative(testUser2, minStk.muln(1000)),
      Sudo.sudoAsWithAddressString(
        foundationAccountAddress,
        Maintenance.switchMaintenanceModeOn(),
      ),
    );
  });
  it.skip("Sequencing must work on mm", async () => {
    const aggregator = testUser1;
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAs(
        testUser2,
        await Staking.joinAsCandidate(
          minStk.muln(2),
          MGA_ASSET_ID,
          tokenOriginEnum.AvailableBalance,
        ),
      ),
      Sudo.sudoAs(
        aggregator,
        Staking.aggregatorUpdateMetadata(
          [testUser2],
          AggregatorOptions.ExtendApprovedCollators,
        ),
      ),
      Sudo.sudoAs(testUser2, Staking.updateCandidateAggregator(aggregator)),
    ).then((events) => {
      expectMGAExtrinsicSuDidSuccess(events);
    });
    const candidateAggData = await Staking.candidateAggregator();
    expect(
      candidateAggData[testUser2.keyRingPair.address.toLowerCase()],
    ).toEqual(aggregator.keyRingPair.address.toLowerCase());
  });

  afterAll(async () => {
    await Sudo.batchAsSudoFinalized(
      Sudo.sudoAsWithAddressString(
        foundationAccountAddress,
        Maintenance.switchMaintenanceModeOff(),
      ),
    );
  });
});
