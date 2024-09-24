/*
 *
 */
import { getApi, initApi } from "../../utils/api";
import { Extrinsic, setupApi, setupUsers } from "../../utils/setup";
import { User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Withdraw } from "../../utils/rolldown";
import { GASP_ASSET_ID } from "../../utils/Constants";
import { ApiPromise } from "@polkadot/api";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import {
  Rolldown,
  createAnUpdateAndCancelIt,
  leaveSequencing,
} from "../../utils/rollDown/Rolldown";

let testUser: User;
let api: ApiPromise;

beforeEach(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  await setupApi();
  api = getApi();
  [testUser] = setupUsers();
  await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
});

test("Given a cancel WHEN block is processed THEN it will create an update that needs to be sent through a batch to L1 for justification", async () => {
  const chain = "Ethereum";
  const preSetupSequencers = {
    Ethereum: "0x3cd0a705a2dc65e5b1e1205896baa2be8a07c6e0",
    Arbitrum: "0x798d4ba9baf0064ec19eb4f0a1a45785ae9d6dfc",
  };
  const activeSequencers = await SequencerStaking.activeSequencers();
  for (const chain in activeSequencers.toHuman()) {
    for (const seq of activeSequencers.toHuman()[chain] as string[]) {
      if (
        seq !== preSetupSequencers.Ethereum &&
        seq !== preSetupSequencers.Arbitrum
      ) {
        await leaveSequencing(seq);
      }
    }
  }
  const [testUser2] = setupUsers();
  const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
  const stakeAndJoinExtrinsic = await SequencerStaking.provideSequencerStaking(
    minToBeSequencer.addn(1000),
    chain,
  );
  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser),
    Assets.mintNative(testUser2),
    Sudo.sudoAs(testUser, stakeAndJoinExtrinsic),
    Sudo.sudoAs(testUser2, stakeAndJoinExtrinsic),
  );
  await createAnUpdateAndCancelIt(
    testUser,
    testUser2.keyRingPair.address,
    chain,
  );
  const batchPeriod = Rolldown.merkleRootBatchPeriod();
  const event = await Rolldown.waitForNextBatchCreated("Ethereum", batchPeriod);
  expect(event.source).toEqual("PeriodReached");
  const l2Request = await Rolldown.getL2Request(
    event.batchId.toNumber(),
    chain,
  );
  expect(l2Request.cancel.requestId.id).toEqual(event.batchId.toNumber());
  expect(l2Request.cancel.updater).toEqual(testUser.keyRingPair.address);
  expect(l2Request.cancel.canceler).toEqual(testUser2.keyRingPair.address);
});

test("Given <32> withdrawals WHEN they run successfully THEN a batch is generated AUTOMATICALLY from that L1, from ranges of (n,n+31)", async () => {
  let number = 0;
  const extrinsicCall: Extrinsic[] = [];
  const gaspToL1Asset = JSON.parse(
    JSON.stringify(await api.query.assetRegistry.idToL1Asset(GASP_ASSET_ID)),
  );
  const nextRequestId = JSON.parse(
    JSON.stringify(await api.query.rolldown.l2OriginRequestId()),
  );
  const batchPeriod = Rolldown.merkleRootBatchPeriod();
  while (++number < 33) {
    const withdrawTx = await Withdraw(
      testUser,
      10,
      gaspToL1Asset.ethereum,
      "Ethereum",
    );
    extrinsicCall.push(withdrawTx);
  }
  await Sudo.batchAsSudoFinalized(...extrinsicCall);
  const event = await Rolldown.waitForNextBatchCreated("Ethereum", batchPeriod);
  const sequencersList = await SequencerStaking.activeSequencers();
  expect(sequencersList.toHuman().Ethereum).toContain(event.assignee);
  expect(event.source).toEqual("AutomaticSizeReached");
  expect(event.range.from.toNumber()).toEqual(nextRequestId.Ethereum);
  expect(event.range.to.toNumber()).toEqual(nextRequestId.Ethereum + 31);
});
