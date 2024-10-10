/*
 *
 * @group withdrawal-rolldown
 */
import { getApi, initApi } from "../../utils/api";
import { getSudoUser, setupApi, setupUsers } from "../../utils/setup";
import { AssetWallet, User } from "../../utils/User";
import { Assets } from "../../utils/Assets";
import { Sudo } from "../../utils/sudo";
import { Withdraw } from "../../utils/rolldown";
import { ETH_ASSET_ID, GASP_ASSET_ID } from "../../utils/Constants";
import { ApiPromise } from "@polkadot/api";
import { SequencerStaking } from "../../utils/rollDown/SequencerStaking";
import {
  L2Update,
  Rolldown,
  createAnUpdate,
  createAnUpdateAndCancelIt,
} from "../../utils/rollDown/Rolldown";
import { BN_HUNDRED, BN_MILLION, signTx } from "gasp-sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult, filterEventData } from "../../utils/eventListeners";
import { waitForNBlocks } from "../../utils/utils";
import { BN } from "@polkadot/util";

let testUser: User;
let sudo: User;
let api: ApiPromise;
let gaspIdL1Asset: any;
let ethIdL1Asset: any;
let waitingBatchPeriod: number;
let batchSize: number;

describe("Withdraw & Batches tests -", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
    await setupApi();
    api = getApi();
    sudo = getSudoUser();
    await setupUsers();
    gaspIdL1Asset = JSON.parse(
      JSON.stringify(await api.query.assetRegistry.idToL1Asset(GASP_ASSET_ID)),
    );
    ethIdL1Asset = JSON.parse(
      JSON.stringify(await api.query.assetRegistry.idToL1Asset(ETH_ASSET_ID)),
    );
    //we need to add 3 blocks to batchPeriod due to the peculiarities of Polkadot's processing of subscribeFinalizedHeads
    waitingBatchPeriod = Rolldown.getMerkleRootBatchPeriod(3);
    batchSize = Rolldown.getMerkleRootBatchSize();
    await Sudo.batchAsSudoFinalized(Assets.mintNative(sudo));
  });

  beforeEach(async () => {
    [testUser] = setupUsers();
    await Sudo.batchAsSudoFinalized(Assets.mintNative(testUser));
    testUser.addAsset(ETH_ASSET_ID);
  });
  test("Given a cancel WHEN block is processed THEN it will create an update that needs to be sent through a batch to L1 for justification", async () => {
    const chain = "Ethereum";
    await SequencerStaking.removeAddedSequencers();
    const [testUser2] = setupUsers();
    const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
    const stakeAndJoinExtrinsic =
      await SequencerStaking.provideSequencerStaking(
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
    const event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    expect(event.source).toEqual("PeriodReached");
    const l2Request = await Rolldown.getL2Request(
      event.range.to.toNumber(),
      chain,
    );
    expect(l2Request.cancel.requestId.id).toEqual(event.range.to.toNumber());
    expect(l2Request.cancel.updater).toEqual(testUser.keyRingPair.address);
    expect(l2Request.cancel.canceler).toEqual(testUser2.keyRingPair.address);
  });

  test("Given a withdraw extrinsic run WHEN token address does not exist THEN a withdraw fail and no l2update is stored", async () => {
    const events = await signTx(
      getApi(),
      await Withdraw(testUser, 10, ethIdL1Asset.ethereum, "Arbitrum"),
      testUser.keyRingPair,
    );
    const filteredEvent = filterEventData(events, "WithdrawalRequestCreated");
    expect(filteredEvent[0]).toBeUndefined();
    const res = getEventResultFromMangataTx(events);
    expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
    expect(res.data).toEqual("TokenDoesNotExist");
  });

  test("Given a withdraw extrinsic run WHEN token address exist but requester does not have funds THEN a withdraw fail and no l2update is stored", async () => {
    await signTx(
      getApi(),
      await Withdraw(testUser, 10, ethIdL1Asset.ethereum, "Ethereum"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(res.data).toEqual("NotEnoughAssets");
    });
  });

  test("Given a succeed withdraw, when block is executed Then tokens are removed from user wallet", async () => {
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(ETH_ASSET_ID, testUser, BN_MILLION),
    );
    await testUser.refreshAmounts(AssetWallet.BEFORE);
    await signTx(
      getApi(),
      await Withdraw(testUser, BN_HUNDRED, ethIdL1Asset.ethereum, "Ethereum"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await testUser.refreshAmounts(AssetWallet.AFTER);
    const withdrawalAmount = testUser
      .getAsset(ETH_ASSET_ID)!
      .amountBefore.free.sub(testUser.getAsset(ETH_ASSET_ID)!.amountAfter.free);
    expect(withdrawalAmount).bnEqual(BN_HUNDRED);
    await Rolldown.waitForNextBatchCreated("Ethereum", waitingBatchPeriod);
  });

  test("GIVEN <batchSize - 1> withdraws, AND manually generated batch and create another withdraw for some other network (arb) THEN the batch is not generated", async () => {
    //since there is no token in the Arbitrum chain by default, we create a new one
    const minToBeSequencer = await SequencerStaking.minimalStakeAmount();
    const blocksForSequencerUpdate =
      await SequencerStaking.getBlocksNumberForSeqUpdate();
    await SequencerStaking.removeAddedSequencers();
    await signTx(
      await getApi(),
      await SequencerStaking.provideSequencerStaking(
        minToBeSequencer.addn(1234),
        "Arbitrum",
      ),
      testUser.keyRingPair,
    );
    await Rolldown.waitForReadRights(
      testUser.keyRingPair.address,
      50,
      "Arbitrum",
    );
    const txIndex = await Rolldown.lastProcessedRequestOnL2("Arbitrum");
    const api = getApi();
    const update = new L2Update(api)
      .withDeposit(
        txIndex,
        testUser.keyRingPair.address,
        testUser.keyRingPair.address,
        BN_MILLION,
      )
      .on("Arbitrum")
      .buildUnsafe();
    await signTx(api, update, testUser.keyRingPair).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await waitForNBlocks(blocksForSequencerUpdate);

    //we need to run <batchSize> extrinsic to update the start of the automatic batching period
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize,
      )),
    );

    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize - 1,
      )),
    );

    await signTx(
      getApi(),
      await Withdraw(
        testUser,
        BN_HUNDRED,
        testUser.keyRingPair.address,
        "Arbitrum",
      ),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    let error: any;
    try {
      await Rolldown.waitForNextBatchCreated("Ethereum", 10);
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(
      "method rolldown.TxBatchCreated not found within blocks limit",
    );
  });

  test("Given a failed deposit TX, then a withdrawal can be created by `refundFailedDeposit", async () => {
    const sequencer = JSON.parse(
      JSON.stringify(await SequencerStaking.activeSequencers()),
    ).Ethereum[0];
    const u128Max = new BN("340282366920938463463374607431768211455");
    const txIndex = await Rolldown.lastProcessedRequestOnL2("Ethereum");
    const update = new L2Update(api)
      .withDeposit(
        txIndex,
        testUser.keyRingPair.address,
        testUser.keyRingPair.address,
        u128Max.addn(1),
      )
      .on("Ethereum")
      .buildUnsafe();
    const depositEvent = await createAnUpdate(
      sequencer,
      "Ethereum",
      txIndex,
      update,
    );

    const event = JSON.parse(
      JSON.stringify(
        await Rolldown.waitForL2UpdateExecuted(new BN(depositEvent.txIndex)),
      ),
    );
    expect(event[0].data[2].err).toEqual("Overflow");

    await signTx(
      getApi(),
      await Rolldown.refundFailedDeposit(depositEvent.txIndex),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await Rolldown.waitForNextBatchCreated("Ethereum", waitingBatchPeriod);
  });
});
