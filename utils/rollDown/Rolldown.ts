import { Extrinsic, setupApi, setupUsers } from "../setup";
import { getApi } from "../api";
import { EthUser } from "../EthUser";
import { BN, nToBigInt } from "@polkadot/util";
import {
  BN_MILLION,
  BN_ONE,
  BN_ZERO,
  MangataGenericEvent,
  signTx,
} from "gasp-sdk";
import { getEventResultFromMangataTx } from "../txHandler";
import { getBlockNumber, stringToBN, waitBlockNumber } from "../utils";
import {
  getEventsAt,
  waitForAllEventsFromMatchingBlock,
  waitForEvents,
  waitNewBlock,
  waitSudoOperationSuccess,
} from "../eventListeners";
import { ApiPromise } from "@polkadot/api";
import { ChainName } from "./SequencerStaking";
import { testLog } from "../Logger";
import { BTreeMap } from "@polkadot/types-codec";
import {
  PalletRolldownMessagesChain,
  PalletRolldownSequencerRights,
  SpRuntimeAccountAccountId20,
  PalletRolldownMessagesDeposit,
} from "@polkadot/types/lookup";
import { User } from "../User";
import { Sudo } from "../sudo";
import {
  abi,
  getAssetIdFromErc20,
  getPublicClient,
  getTransactionFees,
  getWalletClient,
} from "../rollup/ethUtils";
import { getL1, getL1FromName, L1Type } from "../rollup/l1s";
import { closeL1Item } from "../setupsOnTheGo";
import { Withdraw } from "../rolldown";
import {
  Abi,
  decodeFunctionData,
  encodeFunctionData,
  encodeFunctionResult,
  keccak256,
  PrivateKeyAccount,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

export class Rolldown {
  static getUpdateIdFromEvents(
    events: MangataGenericEvent[],
    module = "rolldown",
    method = "WithdrawalRequestCreated",
  ): BN {
    //rolldown.WithdrawalRequestCreated
    const event = getEventResultFromMangataTx(events, [module, method]);
    // @ts-ignore
    return stringToBN(event.data.requestId.id);
  }
  static async createWithdrawalsInBatch(
    num: number,
    userAddress = "0x14dc79964da2c08b23698b3d3cc7ca32193d9955",
    erc20Address = "0x2bdcc0de6be1f7d2ee689a0342d76f52e8efaba3",
    l1: L1Type = "EthAnvil",
  ) {
    const txs = await Rolldown.createWithdrawalTxs(
      num,
      l1,
      userAddress,
      erc20Address,
    );
    await Sudo.batchAsSudoFinalized(...txs);
  }

  static async createWithdrawalTxs(
    num: number,
    l1: "EthAnvil" | "ArbAnvil",
    userAddress: string,
    erc20Address: string,
    amount = BN_ONE,
  ) {
    await setupApi();
    await setupUsers();
    const txs = [];
    for (let index = 0; index < num; index++) {
      const tx = Rolldown.withdraw(l1, userAddress, erc20Address, amount);
      txs.push(tx);
    }
    return txs;
  }

  static withdraw(
    chain: L1Type,
    destAddres: string,
    tokenAddres: string,
    amount: BN,
    ferryTip: null | number = null,
  ) {
    const api = getApi();
    return api.tx.rolldown.withdraw(
      getL1(chain)!.gaspName as unknown as PalletRolldownMessagesChain,
      destAddres,
      tokenAddres,
      amount,
      ferryTip,
    );
  }
  static async lastProcessedRequestOnL2(l1 = "Ethereum") {
    setupUsers();
    const api = getApi();
    const requestId = await api.query.rolldown.lastProcessedRequestOnL2(l1);
    return parseInt(requestId.toString()) + 1;
  }
  static async maxAcceptedRequestIdOnl2(l1 = "Ethereum") {
    setupUsers();
    const api = getApi();
    const requestId = await api.query.rolldown.maxAcceptedRequestIdOnl2(l1);
    return parseInt(requestId.toString());
  }
  static isDepositSucceed(
    events: MangataGenericEvent[],
    userAddress: string,
    amount: BN,
  ) {
    return events.some(
      (x) =>
        x.phase.toString() === "Initialization" &&
        x.event.method === "Deposited" &&
        x.event.section === "tokens" &&
        JSON.stringify(x.event.data).includes(userAddress.toLowerCase()) &&
        Object.hasOwn(x.event.data, "amount") &&
        stringToBN(
          // @ts-ignore : it's secure to access the amount property
          x.event.data["amount"].toString(),
        ).eq(amount),
    );
  }
  static async untilL2Processed(txResult: MangataGenericEvent[]) {
    const blockNo = stringToBN(
      this.getRequestIdFromEvents(txResult).toString(),
    );
    await waitBlockNumber(blockNo.toString(), 10);
    let events = await getEventsAt(blockNo);
    if (!Rolldown.hasL2Processed(events as any[] as MangataGenericEvent[])) {
      //wait one block because of the session change.
      await waitNewBlock();
      events = await getEventsAt(blockNo.addn(1));
    }
    return events as any[] as MangataGenericEvent[];
  }
  static hasL2Processed(events: MangataGenericEvent[]) {
    return events.some((x) => {
      return (
        x.event.section === "rolldown" &&
        x.event.method === "RequestProcessedOnL2"
      );
    });
  }
  static async deposit(
    user: EthUser,
    requestIdx: number,
    ethAddress: string,
    amount: BN,
  ) {
    const tx = new L2Update(getApi())
      .withDeposit(requestIdx, ethAddress, ethAddress, amount.toNumber())
      .buildUnsafe();
    const api = getApi();
    return await signTx(api, tx, user.keyRingPair);
  }

  static async waitForReadRights(
    userAddress: string,
    maxBlocks = 61,
    chain: ChainName = "Ethereum",
  ) {
    while (maxBlocks-- > 0) {
      testLog
        .getLog()
        .info(
          `Waiting for read rights ${maxBlocks} : ${chain} : ${userAddress}`,
        );
      const seqRights = await getApi().query.rolldown.sequencersRights(chain);
      testLog.getLog().info(JSON.stringify(seqRights.toHuman()));
      const selectedSequencer =
        await getApi().query.sequencerStaking.selectedSequencer();
      testLog.getLog().info(JSON.stringify(selectedSequencer.toHuman()));
      const isSelectedSeq = Object.values(selectedSequencer.toHuman()).includes(
        userAddress,
      );
      const reads =
        (seqRights.toHuman()[userAddress] as any) !== undefined &&
        (seqRights.toHuman()[userAddress] as any).readRights;
      if (reads && parseInt(reads) > 0 && isSelectedSeq) {
        return;
      } else {
        await waitNewBlock();
      }
    }
    throw new Error("Max blocks reached without getting read rights");
  }

  static async disputePeriodLength() {
    const api = getApi();
    return (await api.consts.rolldown.disputePeriodLength) as any as BN;
  }

  static getMerkleRootBatchPeriod(extraBlocksNumber = 0) {
    const api = getApi();
    const batchPeriod =
      api.consts.rolldown.merkleRootAutomaticBatchPeriod.toNumber() +
      extraBlocksNumber;
    return batchPeriod as number;
  }

  static getMerkleRootBatchSize() {
    const api = getApi();
    return api.consts.rolldown.merkleRootAutomaticBatchSize.toNumber() as number;
  }

  static async cancelRequestFromL1(chainId: ChainName, reqId: number) {
    const api = getApi();
    return api.tx.rolldown.cancelRequestsFromL1(chainId, reqId);
  }

  static async forceCancelRequestFromL1(chainId: ChainName, reqId: number) {
    const api = getApi();
    return api.tx.rolldown.forceCancelRequestsFromL1(chainId, reqId);
  }

  static getRequestIdFromEvents(
    events: MangataGenericEvent[],
    module = "rolldown",
    method = "L1ReadStored",
  ) {
    const event = getEventResultFromMangataTx(events, [module, method]);
    const disputePeriodEnd = JSON.parse(
      JSON.stringify(event.data),
    ).disputePeriodEnd;
    return stringToBN(disputePeriodEnd).toNumber();
  }
  static getRequestIdFromCancelEvent(
    cancel: MangataGenericEvent[],
    rolldown: string = "rolldown",
    l1ReadCanceled: string = "L1ReadCanceled",
  ) {
    const event = getEventResultFromMangataTx(cancel, [
      rolldown,
      l1ReadCanceled,
    ]);
    // @ts-ignore
    return stringToBN(event.data.assignedId.id).toNumber();
  }

  static async sequencerRights(chain: string, seqAddress: string) {
    const api = getApi();
    const rights = (await api.query.rolldown.sequencersRights(
      chain,
    )) as any as unknown as BTreeMap<
      SpRuntimeAccountAccountId20,
      PalletRolldownSequencerRights
    >;
    testLog.getLog().info(`Rights : ${rights.toJSON()}`);
    return api.createType(
      "PalletRolldownSequencerRights",
      rights.toJSON()[seqAddress],
    ) as any as PalletRolldownSequencerRights;
  }

  static async isTokenBalanceIncreased(
    tokenAddress: string,
    chain: any,
    gt: BN = BN_ZERO,
  ) {
    const api = getApi();
    const l1 = getL1FromName(chain)!;
    const assetId = await getAssetIdFromErc20(tokenAddress, l1);
    if (assetId.lte(BN_ZERO)) {
      return false;
    } else {
      const balance = await api.query.tokens.accounts(tokenAddress, assetId);
      return balance.free.toBn().gt(gt);
    }
  }

  static async wasAssetRegistered(blockNumber: number) {
    const api = getApi();
    const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
    const events = await api.query.system.events.at(blockHash);
    const filteredEvent = events.filter(
      (result: any) => result.event.method === "RegisteredAsset",
    );
    return filteredEvent[0] !== undefined;
  }

  static async getRegisteredAssetId(blockNumber: number) {
    const api = getApi();
    const blockHash = await api.rpc.chain.getBlockHash(blockNumber);
    const events = await api.query.system.events.at(blockHash);
    const filteredEvent = events.filter(
      (result: any) => result.event.method === "RegisteredAsset",
    );
    // @ts-ignore
    return new BN(filteredEvent[0].event.data.assetId.toString());
  }

  static async waitCancelResolution(chain = "Ethereum") {
    setupUsers();
    const api = getApi();
    const waitingResolution =
      await api.query.rolldown.awaitingCancelResolution(chain);
    return JSON.parse(JSON.stringify(waitingResolution));
  }

  static async createManualBatch(l1: L1Type) {
    const api = await getApi();
    return api.tx.rolldown.createBatch(
      getL1(l1)!.gaspName as unknown as PalletRolldownMessagesChain,
      null,
    );
  }

  static async createForceManualBatch(
    from: number,
    to: number,
    sequencer: any,
    chain: ChainName = "Ethereum",
  ) {
    const api = await getApi();
    return api.tx.rolldown.forceCreateBatch(chain, [from, to], sequencer);
  }

  static async closeCancelOnL1(requestId: bigint, chainName = "Ethereum") {
    await closeL1Item(requestId, "close_cancel", chainName);
  }

  static hashL1Update(L2Request: any) {
    // Encode the function data using the full ABI
    const json = JSON.parse(JSON.stringify(L2Request));
    json.chain = json.chain === "Ethereum" ? nToBigInt(0) : nToBigInt(1);
    json.pendingDeposits.forEach(
      (dep: any) =>
        (dep.requestId.origin = dep.requestId.origin === "L1" ? 0 : 1),
    );
    json.pendingCancelResolutions.forEach(
      (cr: any) => (cr.requestId.origin = cr.requestId.origin === "L1" ? 0 : 1),
    );
    const encoded = encodeFunctionResult({
      abi: abi,
      functionName: "getPendingRequests",
      result: json,
    });

    // to debug JIC
    // const decoded = decodeFunctionResult({
    // abi: abi,
    // functionName: "getPendingRequests",
    // data: encoded as `0x${string}`,
    //});
    testLog.getLog().info("Tx- encoded" + encoded);
    testLog.getLog().info("Tx- encoded hash" + keccak256(encoded));
    return keccak256(encoded);
  }
  static async getL2Request(
    idNumber: number,
    chain = "Ethereum",
    originValue = "L2",
  ) {
    setupUsers();
    const api = getApi();
    const l2Request = JSON.parse(
      JSON.stringify(
        await api.query.rolldown.l2Requests(chain, {
          origin: originValue,
          id: idNumber,
        }),
      ),
    );

    return l2Request[0];
  }

  static async waitForL2UpdateExecuted(requestId: BN) {
    const event = await waitForAllEventsFromMatchingBlock(
      getApi(),
      20,
      (ev) =>
        ev.method === "RequestProcessedOnL2" &&
        ev.section === "rolldown" &&
        (ev.data.toHuman() as any).requestId.toString() ===
          requestId.toString(),
    );
    return event;
  }

  static async waitForNextBatchCreated(chain: string, blocksLimit = 25) {
    const api = await getApi();
    const startBlock = await getBlockNumber();
    const event = (await waitForEvents(
      api,
      "rolldown.TxBatchCreated",
      blocksLimit,
      chain,
      startBlock,
    )) as any[];
    const eventChain = event[0].event.data[0].toString();
    const source = event[0].event.data[1].toString();
    const assignee = event[0].event.data[2].toString();
    const batchId = event[0].event.data[3];
    const range = {
      from: event[0].event.data[4][0],
      to: event[0].event.data[4][1],
    };
    expect(chain).toEqual(eventChain);
    return { source, assignee, batchId, range };
  }

  static async createABatchWithWithdrawals(
    user: User,
    tokenAddress: string,
    batchSize: number,
    chain: ChainName = "Ethereum",
    amountValue = 100,
  ) {
    let number = 0;
    const extrinsicCall: Extrinsic[] = [];
    while (++number <= batchSize) {
      const withdrawTx = await Withdraw(user, amountValue, tokenAddress, chain);
      extrinsicCall.push(withdrawTx);
    }
    return extrinsicCall;
  }

  static depositFerryUnsafe(
    deposit: PalletRolldownMessagesDeposit,
    l1: L1Type,
  ) {
    return getApi().tx.rolldown.ferryDepositUnsafe(
      //@ts-ignore
      getL1(l1)!.gaspName,
      deposit.requestId,
      deposit.depositRecipient,
      deposit.tokenAddress,
      deposit.amount,
      deposit.timeStamp,
      deposit.ferryTip,
    );
  }

  static async ferryWithdrawal(
    l1: L1Type,
    ferry: User,
    user: User,
    // eslint-disable-next-line no-template-curly-in-string
    tokenAddress: "0x${string}",
    amount: number,
    tip: number,
    requestId: any,
  ) {
    const publicClient = getPublicClient(l1);
    const walletClient = getWalletClient(l1);
    const account: PrivateKeyAccount = privateKeyToAccount(
      ferry.name as `0x${string}`,
    );
    const withdrawal = {
      requestId: {
        origin: requestId.origin,
        id: requestId.id,
      },
      recipient: user.keyRingPair.address,
      tokenAddress: tokenAddress,
      amount: nToBigInt(amount),
      ferryTip: nToBigInt(tip),
    };
    const encodedData = encodeFunctionData({
      abi,
      functionName: "ferry_withdrawal",
      args: [withdrawal],
    });

    const decoded = decodeFunctionData({
      abi,
      data: encodedData,
    });

    testLog.getLog().info(`Encoded Data: ${encodedData}`);
    testLog.getLog().info(`Decoded Data:${JSON.stringify(decoded)}`);

    const { request } = await publicClient.simulateContract({
      account,
      address: getL1(l1).contracts.rollDown.address as unknown as `0x${string}`,
      abi: abi as Abi,
      functionName: "ferry_withdrawal",
      args: [withdrawal],
      value: withdrawal.amount - withdrawal.ferryTip,
    });

    return await walletClient.writeContract(request).then(async (txHash) => {
      const result = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      testLog
        .getLog()
        .info(
          `ferrying withdrawal ${withdrawal.requestId.id}: tx:${result.transactionHash} - ${result.status}`,
        );
      testLog.getLog().info("L1 item ferried with tx", request);
      return getTransactionFees(txHash, publicClient);
    });
  }

  static async getL2RequestsBatchLast() {
    let chain: ChainName;
    let blockId: any;
    let batchId: any;
    let rangeFrom: any;
    let rangeTo: any;
    const l2RequestsBatchLast = JSON.parse(
      JSON.stringify(await getApi().query.rolldown.l2RequestsBatchLast()),
    );
    if (l2RequestsBatchLast.Ethereum !== undefined) {
      chain = "Ethereum";
      blockId = l2RequestsBatchLast!.Ethereum[0];
      batchId = l2RequestsBatchLast!.Ethereum[1];
      rangeFrom = l2RequestsBatchLast!.Ethereum[2][0];
      rangeTo = l2RequestsBatchLast!.Ethereum[2][1];
    } else {
      chain = "Arbitrum";
      blockId = l2RequestsBatchLast!.Arbitrum[0];
      batchId = l2RequestsBatchLast!.Arbitrum[1];
      rangeFrom = l2RequestsBatchLast!.Arbitrum[2][0];
      rangeTo = l2RequestsBatchLast!.Arbitrum[2][1];
    }
    return { chain, blockId, batchId, rangeFrom, rangeTo };
  }

  static async refundFailedDeposit(
    requestId: number,
    chain: ChainName = "Ethereum",
  ) {
    const api = await getApi();
    return api.tx.rolldown.refundFailedDeposit(chain, requestId);
  }
}
export class L2Update {
  api: ApiPromise;
  pendingDeposits: any[];
  pendingCancelResolutions: any[];
  chain: string = "Ethereum";

  constructor(api: ApiPromise) {
    this.api = api;
    this.pendingDeposits = this.api.createType(
      "Vec<PalletRolldownMessagesDeposit>",
    );
    this.pendingCancelResolutions = this.api.createType(
      "Vec<PalletRolldownMessagesCancelResolution>",
    );
  }
  buildUnsafe() {
    return this.api.tx.rolldown.updateL2FromL1Unsafe(this.buildParams());
  }
  buildSafe() {
    const tx = this.buildParams();
    const hash = Rolldown.hashL1Update(tx);
    testLog.getLog().info("Hash:" + hash);
    return this.api.tx.rolldown.updateL2FromL1(this.buildParams(), hash);
  }
  forceBuild() {
    return this.api.tx.rolldown.forceUpdateL2FromL1(this.buildParams());
  }

  public buildParams() {
    return {
      chain: this.api.createType("PalletRolldownMessagesChain", this.chain),
      pendingDeposits: this.api.createType(
        "Vec<PalletRolldownMessagesDeposit>",
        this.pendingDeposits,
      ),
      pendingCancelResolutions: this.api.createType(
        "Vec<PalletRolldownMessagesCancelResolution>",
        this.pendingCancelResolutions,
      ),
    };
  }

  clone(fromIndex: number, number: number) {
    let index = fromIndex;
    this.pendingDeposits.forEach((x) => {
      for (let i = 0; i < number; i++) {
        index++;
        this.withDeposit(index, x.depositRecipient, x.tokenAddress, x.amount);
      }
    });
    this.pendingCancelResolutions.forEach((x) => {
      for (let i = 0; i < number; i++) {
        index++;
        this.withCancelResolution(index, x.l2RequestId, x.cancelJustified);
      }
    });

    return this;
  }
  on(chainName = "Ethereum") {
    this.chain = chainName;
    return this;
  }
  withDeposit(
    txIndex: number,
    ethAddress: string,
    erc20Address: string,
    amountValue: number | BN,
    timestamp: number = Date.now(),
    ferryTip: BN = BN_ZERO,
  ) {
    const deposit = this.api.createType("PalletRolldownMessagesDeposit", {
      requestId: this.api.createType("PalletRolldownMessagesRequestId", [
        "L1",
        txIndex,
      ]),
      depositRecipient: ethAddress,
      tokenAddress: erc20Address,
      amount: amountValue,
      timeStamp: timestamp,
      ferryTip: ferryTip,
    });
    this.pendingDeposits.push(deposit);
    return this;
  }
  withCancelResolution(
    txIndex: number,
    l2RequestId: number,
    cancelJustified: boolean,
    timestamp: number = Date.now(),
  ) {
    const cancelResolution = this.api.createType(
      "PalletRolldownMessagesCancelResolution",
      {
        requestId: this.api.createType("PalletRolldownMessagesRequestId", [
          "L1",
          txIndex,
        ]),
        l2RequestId: l2RequestId,
        cancelJustified: cancelJustified,
        timeStamp: timestamp,
      },
    );
    this.pendingCancelResolutions.push(cancelResolution);
    return this;
  }
}

export async function createAnUpdate(
  seq: User | string,
  chain: ChainName = "Arbitrum",
  forcedIndex = 0,
  updateValue: any = null,
  depositAmountValue = BN_MILLION,
) {
  const address = typeof seq === "string" ? seq : seq.keyRingPair.address;
  await Rolldown.waitForReadRights(address, 50, chain);
  let txIndex = await Rolldown.lastProcessedRequestOnL2(chain);
  if (forcedIndex !== 0) {
    txIndex = forcedIndex;
  }
  const api = getApi();
  let update: any;
  if (updateValue === null) {
    update = new L2Update(api)
      .withDeposit(txIndex, address, address, depositAmountValue)
      .on(chain)
      .buildUnsafe();
  } else {
    update = updateValue;
  }
  let reqId = 0;
  await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(address, update),
  ).then(async (events) => {
    await waitSudoOperationSuccess(events, "SudoAsDone");
    reqId = Rolldown.getRequestIdFromEvents(events);
  });
  return { txIndex, api, reqId };
}

export async function createAnUpdateAndCancelIt(
  seq: User,
  cancelerAddress: string,
  chain: ChainName = "Arbitrum",
  updateValue: any = null,
  forcedIndex = 0,
) {
  const { txIndex, api, reqId } = await createAnUpdate(
    seq,
    chain,
    forcedIndex,
    updateValue,
  );
  const cancel = await Sudo.asSudoFinalized(
    Sudo.sudoAsWithAddressString(
      cancelerAddress,
      await Rolldown.cancelRequestFromL1(chain, reqId),
    ),
  );
  await waitSudoOperationSuccess(cancel, "SudoAsDone");
  const reqIdCanceled = Rolldown.getRequestIdFromCancelEvent(cancel);
  return { txIndex, api, reqId, reqIdCanceled };
}
