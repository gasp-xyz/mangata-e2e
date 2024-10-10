/*
 *
 * @group preOperationWithdrawal-rolldown
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
import { Rolldown } from "../../utils/rollDown/Rolldown";
import { BN_HUNDRED, BN_MILLION, BN_ZERO, signTx } from "gasp-sdk";
import { getEventResultFromMangataTx } from "../../utils/txHandler";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { Maintenance } from "../../utils/Maintenance";

let testUser: User;
let sudo: User;
let api: ApiPromise;
let gaspIdL1Asset: any;
let ethIdL1Asset: any;
let waitingBatchPeriod: number;
let batchSize: number;
let nextRequestIdEth: number;

async function getLastBatchId() {
  api = getApi();
  const l2RequestsBatchLast = JSON.parse(
    JSON.stringify(await api.query.rolldown.l2RequestsBatchLast()),
  );
  const batchId = l2RequestsBatchLast!.Ethereum[1];
  return batchId;
}

describe("Pre-operation withdrawal tests -", () => {
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
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize,
      )),
    );
    const event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    expect(event.source).toEqual("AutomaticSizeReached");
    nextRequestIdEth = event.range.to.toNumber() + 1;
  });

  test("Given <batchSize> withdrawals WHEN they run successfully THEN a batch is generated AUTOMATICALLY from that L1, from ranges of (n,n+<batchSize>-1)", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize,
      )),
    );
    const event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    const sequencersList = await SequencerStaking.activeSequencers();
    expect(sequencersList.toHuman().Ethereum).toContain(event.assignee);
    expect(event.source).toEqual("AutomaticSizeReached");
    expect(event.range.from.toNumber()).toEqual(nextRequestIdEth);
    expect(event.range.to.toNumber()).toEqual(
      nextRequestIdEth + (batchSize - 1),
    );
  });

  test("Given a withdraw extrinsic run WHEN tokens are available THEN a withdraw will happen and l2Requests will be stored waiting for batch", async () => {
    await signTx(
      getApi(),
      await Withdraw(testUser, 10, gaspIdL1Asset.ethereum, "Ethereum"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    const event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    const l2Request = await Rolldown.getL2Request(event.range.to.toNumber());
    expect(l2Request.withdrawal.tokenAddress).toEqual(gaspIdL1Asset.ethereum);
    expect(l2Request.withdrawal.withdrawalRecipient).toEqual(
      testUser.keyRingPair.address,
    );
  });

  test("Given a withdraw extrinsic run WHEN token is Eth and user has some tokens THEN a withdraw will happen and update will be stored on l2Requests and will be stored waiting for batch", async () => {
    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(ETH_ASSET_ID, testUser, BN_MILLION),
    );
    await signTx(
      getApi(),
      await Withdraw(testUser, BN_HUNDRED, ethIdL1Asset.ethereum, "Ethereum"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    const event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    const l2Request = await Rolldown.getL2Request(event.range.to.toNumber());
    expect(l2Request.withdrawal.tokenAddress).toEqual(ethIdL1Asset.ethereum);
    expect(l2Request.withdrawal.withdrawalRecipient).toEqual(
      testUser.keyRingPair.address,
    );
  });

  test("Given a withdraw in a batch extrinsic, When one of the calls fail from the batch, then tokens are reverted ( transactional )", async () => {
    const requestIdBefore = JSON.parse(
      JSON.stringify(await api.query.rolldown.l2OriginRequestId()),
    );
    const events = await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        10,
      )),
      await Withdraw(testUser, 10, gaspIdL1Asset.ethereum, "Arbitrum"),
    );
    const error = events.filter(
      (x) => x.method === "ExtrinsicFailed" && x.section === "system",
    );
    expect(error.length).toBe(1);
    expect(error[0].error!.name).toBe("TokenDoesNotExist");
    const requestIdAfter = JSON.parse(
      JSON.stringify(await api.query.rolldown.l2OriginRequestId()),
    );
    await testUser.refreshAmounts(AssetWallet.AFTER);
    const withdrawalAmount = testUser
      .getAsset(ETH_ASSET_ID)!
      .amountBefore.free.sub(testUser.getAsset(ETH_ASSET_ID)!.amountAfter.free);
    expect(withdrawalAmount).bnEqual(BN_ZERO);
    expect(requestIdBefore).toEqual(requestIdAfter);
  });

  test("Given <3> withdrawals WHEN they run successfully and we wait <batchPeriod> blocks, a batch is created upon reaching the period", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        3,
      )),
    );
    const event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    const sequencersList = await SequencerStaking.activeSequencers();
    expect(sequencersList.toHuman().Ethereum).toContain(event.assignee);
    expect(event.source).toEqual("PeriodReached");
    expect(event.range.from.toNumber()).toEqual(nextRequestIdEth);
    expect(event.range.to.toNumber()).toEqual(nextRequestIdEth + 2);
  });

  test("Given <1> withdrawal WHEN we manually generate a batch for it THEN a batch is generated", async () => {
    await signTx(
      getApi(),
      await Withdraw(testUser, BN_HUNDRED, gaspIdL1Asset.ethereum, "Ethereum"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    await signTx(
      getApi(),
      await Rolldown.createManualBatch("EthAnvil"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    const event = await Rolldown.waitForNextBatchCreated("Ethereum", 0);
    expect(event.assignee).toEqual(testUser.keyRingPair.address);
    expect(event.source).toEqual("Manual");
  });

  test("GIVEN <batchSize - 1> withdraws and create manualBatch And wait for a timed generation WHEN another withdrawal is submitted THEN a batch is generated", async () => {
    let event: any;
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize - 1,
      )),
    );
    await signTx(
      getApi(),
      await Rolldown.createManualBatch("EthAnvil"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    expect(event.assignee).toEqual(testUser.keyRingPair.address);
    expect(event.source).toEqual("Manual");
    expect(event.range.from.toNumber()).toEqual(nextRequestIdEth);
    expect(event.range.to.toNumber()).toEqual(
      nextRequestIdEth + (batchSize - 2),
    );
    await signTx(
      getApi(),
      await Withdraw(testUser, BN_HUNDRED, gaspIdL1Asset.ethereum, "Ethereum"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    const sequencersList = await SequencerStaking.activeSequencers();
    expect(sequencersList.toHuman().Ethereum).toContain(event.assignee);
    expect(event.source).toEqual("PeriodReached");
    expect(event.range.from.toNumber()).toEqual(
      nextRequestIdEth + (batchSize - 1),
    );
    expect(event.range.to.toNumber()).toEqual(
      nextRequestIdEth + (batchSize - 1),
    );
  });

  test("GIVEN <batchSize - 1> withdraws and create manualBatch And wait for a timed generation WHEN create batch with <batchSize - 1> withdrawal and add another one THEN a batch is generated automatically", async () => {
    let event: any;
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize - 1,
      )),
    );
    await signTx(
      getApi(),
      await Rolldown.createManualBatch("EthAnvil"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    expect(event.assignee).toEqual(testUser.keyRingPair.address);
    expect(event.source).toEqual("Manual");
    const nextRequestId = (await Rolldown.getL2RequestsBatchLast()).rangeTo + 1;
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize - 1,
      )),
    );
    await signTx(
      getApi(),
      await Withdraw(testUser, BN_HUNDRED, gaspIdL1Asset.ethereum, "Ethereum"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    const sequencersList = await SequencerStaking.activeSequencers();
    expect(sequencersList.toHuman().Ethereum).toContain(event.assignee);
    expect(event.source).toEqual("AutomaticSizeReached");
    expect(event.range.from.toNumber()).toEqual(nextRequestId);
    expect(event.range.to.toNumber()).toEqual(nextRequestId + (batchSize - 1));
  });

  test("GIVEN a manually generated batch, from A,B, WHEN timed happen THEN automatic batch will skip those manual ids", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize - 1,
      )),
    );
    await signTx(
      getApi(),
      await Rolldown.createManualBatch("EthAnvil"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    const eventManually = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    expect(eventManually.assignee).toEqual(testUser.keyRingPair.address);
    expect(eventManually.source).toEqual("Manual");
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize,
      )),
    );
    const eventAutomatically = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    const sequencersList = await SequencerStaking.activeSequencers();
    expect(sequencersList.toHuman().Ethereum).toContain(
      eventAutomatically.assignee,
    );
    expect(eventAutomatically.source).toEqual("AutomaticSizeReached");
    expect(eventAutomatically.range.from.toNumber()).toBeGreaterThan(
      eventManually.range.to.toNumber(),
    );
  });

  test("GIVEN a manually generated batch, from A,B, WHEN up to 32 withdrawals happen THEN another automatic batch will run only including that missing id", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize - 1,
      )),
    );
    await signTx(
      getApi(),
      await Rolldown.createManualBatch("EthAnvil"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    const eventManually = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    expect(eventManually.assignee).toEqual(testUser.keyRingPair.address);
    expect(eventManually.source).toEqual("Manual");
    expect(eventManually.range.from.toNumber()).toEqual(nextRequestIdEth);
    expect(eventManually.range.to.toNumber()).toEqual(
      nextRequestIdEth + (batchSize - 2),
    );
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        1,
      )),
    );
    const eventAutomatically = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    const sequencersList = await SequencerStaking.activeSequencers();
    expect(sequencersList.toHuman().Ethereum).toContain(
      eventAutomatically.assignee,
    );
    expect(eventAutomatically.source).toEqual("PeriodReached");
    expect(eventAutomatically.range.from.toNumber()).toEqual(
      nextRequestIdEth + (batchSize - 1),
    );
    expect(eventAutomatically.range.to.toNumber()).toEqual(
      nextRequestIdEth + (batchSize - 1),
    );
  });

  test("GIven a utility.batch ( batched tx of 35 and last item in the utility.batch is the mm_on ) When maintenance mode, THEN No automatic batch can happen", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        batchSize,
      )),
      Maintenance.switchMaintenanceModeOn(),
    );
    let error: any;
    try {
      await Rolldown.waitForNextBatchCreated("Ethereum", 10);
    } catch (err) {
      error = err;
    }
    expect(error).toEqual(
      "method rolldown.TxBatchCreated not found within blocks limit",
    );
    await Sudo.batchAsSudoFinalized(Maintenance.switchMaintenanceModeOff());
  });

  test("Creating two merkle trees generates the same output", async () => {
    const batchIdBefore = await getLastBatchId();
    const withEvent = await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        10,
      )),
    );
    const filteredEvent = JSON.parse(
      JSON.stringify(
        withEvent.filter(
          (event) => event.method === "WithdrawalRequestCreated",
        ),
      ),
    );
    const idFromNumber = filteredEvent[0].event.data[1].id;
    const idToNumber = filteredEvent[9].event.data[1].id;
    const sequencer = JSON.parse(
      JSON.stringify(await SequencerStaking.activeSequencers()),
    ).Ethereum[0];
    await Sudo.batchAsSudoFinalized(
      Sudo.sudo(
        await Rolldown.createForceManualBatch(
          idFromNumber,
          idToNumber,
          sequencer,
          "Ethereum",
        ),
      ),
      Sudo.sudo(
        await Rolldown.createForceManualBatch(
          idFromNumber,
          idToNumber,
          sequencer,
          "Ethereum",
        ),
      ),
    );
    const batchIdAfter = await getLastBatchId();
    expect(batchIdAfter).toEqual(batchIdBefore + 2);
  });

  test("Given a manually batch generation, WHEN is not the forced, THEN start-end will be calculated automatically", async () => {
    const events = await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        2,
      )),
      await Rolldown.createManualBatch("EthAnvil"),
    );
    const filteredEvent = JSON.parse(
      JSON.stringify(
        events.filter((event) => event.method === "TxBatchCreated"),
      ),
    );
    expect(filteredEvent[0].event.data[4][0]).toEqual(nextRequestIdEth);
    expect(filteredEvent[0].event.data[4][1]).toEqual(nextRequestIdEth + 1);
  });

  test("Given a manually batch generation, WHEN is the forced ( sudo ) , THEN start-end must be set manually", async () => {
    const sequencer = JSON.parse(
      JSON.stringify(await SequencerStaking.activeSequencers()),
    ).Ethereum[0];
    const events = await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        2,
      )),
      Sudo.sudo(
        await Rolldown.createForceManualBatch(
          nextRequestIdEth,
          nextRequestIdEth + 1,
          sequencer,
          "Ethereum",
        ),
      ),
    );
    const filteredEvent = JSON.parse(
      JSON.stringify(
        events.filter((event) => event.method === "TxBatchCreated"),
      ),
    );
    expect(filteredEvent[0].event.data[4][0]).toEqual(nextRequestIdEth);
    expect(filteredEvent[0].event.data[4][1]).toEqual(nextRequestIdEth + 1);
  });

  test("Given a non-forced manually generation, WHEN triggered, start will be the latest index from the last generated MAX( manual or automatically ) and last will be the latest requestId", async () => {
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        2,
      )),
    );
    await signTx(
      getApi(),
      await Rolldown.createManualBatch("EthAnvil"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
    const event = await Rolldown.waitForNextBatchCreated(
      "Ethereum",
      waitingBatchPeriod,
    );
    expect(event.range.from.toNumber()).toEqual(nextRequestIdEth);
    expect(event.range.to.toNumber()).toEqual(nextRequestIdEth + 1);
  });

  test("GIVEN a manual batch WHEN no pending requests THEN no batch is generated BUT tokens are subtracted", async () => {
    testUser.addAsset(GASP_ASSET_ID);
    await testUser.refreshAmounts(AssetWallet.BEFORE);
    await signTx(
      getApi(),
      await Rolldown.createManualBatch("EthAnvil"),
      testUser.keyRingPair,
    ).then((events) => {
      const res = getEventResultFromMangataTx(events);
      expect(res.state).toEqual(ExtrinsicResult.ExtrinsicFailed);
      expect(res.data).toEqual("EmptyBatch");
    });
    await testUser.refreshAmounts(AssetWallet.AFTER);
    expect(testUser.getAsset(GASP_ASSET_ID)!.amountBefore.free!).bnGt(
      testUser.getAsset(GASP_ASSET_ID)!.amountAfter.free!,
    );
  });

  test("GIVEN manual batch THEN requires as parameter of the Chain", async () => {
    const l2RequestsBatchBefore = await Rolldown.getL2RequestsBatchLast();
    await Sudo.batchAsSudoFinalized(
      ...(await Rolldown.createABatchWithWithdrawals(
        testUser,
        gaspIdL1Asset.ethereum,
        2,
      )),
      await Rolldown.createManualBatch("EthAnvil"),
    );
    const l2RequestsBatchAfter = await Rolldown.getL2RequestsBatchLast();
    expect(l2RequestsBatchBefore.chain).toBe("Ethereum");
    expect(l2RequestsBatchAfter.chain).toBe("Ethereum");
    expect(l2RequestsBatchAfter.batchId).toBe(
      l2RequestsBatchBefore.batchId + 1,
    );
    expect(l2RequestsBatchAfter.rangeTo).toBe(
      l2RequestsBatchBefore.rangeTo + 2,
    );
  });
});
