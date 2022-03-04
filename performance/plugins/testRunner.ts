/* eslint-disable no-loop-func */
import BN from "bn.js";
import { Mangata } from "mangata-sdk";
import { testLog } from "../../utils/Logger";
import { logFile, TestParams } from "../testParams";
import { captureEvents, logLine, pendingExtrinsics } from "./testReporter";
import { KeyringPair } from "@polkadot/keyring/types";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import { SubmittableResult } from "@polkadot/api";

import asyncPool from "tiny-async-pool";
import { TestsCases } from "../testFactory";

export async function preGenerateTransactions(
  testParams: TestParams,
  mgaNodeandUsers: Map<
    number,
    { mgaSdk: Mangata; users: { nonce: BN; keyPair: KeyringPair }[] }
  >,
  fn: any
): Promise<SubmittableExtrinsic<"promise", SubmittableResult>[][]> {
  testLog
    .getLog()
    .info(
      `Pregenerating ${testParams.totalTx} transactions across ${testParams.threads} threads...`
    );
  const api = await mgaNodeandUsers.get(0)?.mgaSdk.getApi();
  captureEvents(logFile, api!);
  pendingExtrinsics(logFile, api!);
  const totalBatches = testParams.totalTx / testParams.threads;
  //const userPerThread = 1;

  const thread_payloads: SubmittableExtrinsic<
    "promise",
    SubmittableResult
  >[][] = [];
  let sanityCounter = 0;
  for (let nodeThread = 0; nodeThread < testParams.nodes.length; nodeThread++) {
    const batches = [];
    for (let batchNo = 0; batchNo < totalBatches; batchNo++) {
      const batch = [];
      for (
        let userNo = 0;
        userNo < mgaNodeandUsers.get(nodeThread)!.users.length;
        userNo++
      ) {
        const { mgaValue, signed } = await fn(
          mgaNodeandUsers,
          nodeThread,
          userNo
        );
        const userNonceIncremented = mgaValue.users[userNo]!.nonce.add(
          new BN(1)
        );
        mgaValue.users[userNo]!.nonce! = userNonceIncremented;
        batch.push(signed);

        sanityCounter++;
      }
      batches.push(batch);
    }
    const flatten = batches.reduce(
      (accumulator, value) => accumulator.concat(value),
      []
    );
    thread_payloads.push(flatten);
  }
  testLog.getLog().info(`Done pregenerating transactions (${sanityCounter}).`);
  return thread_payloads;
}

export async function runTransactions(
  testParams: TestParams,
  preSetupThreads: SubmittableExtrinsic<"promise", SubmittableResult>[][]
) {
  const nodePromises: any[] = [];

  for (let nodeIdx = 0; nodeIdx < testParams.nodes.length; nodeIdx++) {
    const nodeThreads = testParams.threads;
    if (testParams.testCase === TestsCases.ConcurrentTest) {
      nodePromises.push(
        runTxsInConcurrentMode(
          preSetupThreads,
          nodeIdx,
          testParams,
          nodeThreads
        )
      );
    } else if (testParams.testCase === TestsCases.Burst) {
      nodePromises.push(
        runTxsInBurstMode(preSetupThreads, nodeIdx, testParams)
      );
    }
  }
  const results = await Promise.all(nodePromises);
  // eslint-disable-next-line no-console
  testLog.getLog().info(`Sent!`);
  testLog.getLog().info("All promises fulfilled");
  return results;
}

async function runTxsInConcurrentMode(
  preSetupThreads: SubmittableExtrinsic<"promise", SubmittableResult>[][],
  nodeIdx: number,
  testParams: TestParams,
  nodeThreads: number
) {
  const runNodeTxs = (i: number) =>
    new Promise<[number, number]>(async (resolve) => {
      const transaction = await preSetupThreads[nodeIdx][i];
      const start = new Date().getTime();
      await transaction
        .send(({ status }) => {
          if (status.isInBlock) {
            const finalized = new Date().getTime();
            const diff = finalized - start;
            resolve([i, diff]);
            logLine(
              testParams.logFile,
              "\n" +
                new Date().toUTCString() +
                "-" +
                JSON.stringify(status.toHuman()!)
            );
            return;
          }
        })
        .catch((err: any) => {
          logLine(
            testParams.logFile,
            "\n" +
              new Date().toUTCString() +
              "- ERROR - " +
              JSON.stringify(err.toHuman()!)
          );
          testLog.getLog().warn(err);
          return -1;
        });
    });
  const nodeTxs = preSetupThreads[nodeIdx];
  const indexArray = nodeTxs.map((_, index) => {
    return index;
  });
  testLog
    .getLog()
    .info(
      `Sending  in ${nodeThreads} Threads ${preSetupThreads[0].length} Txs...`
    );
  await asyncPool(nodeThreads, indexArray, runNodeTxs);
}
async function runTxsInBurstMode(
  preSetupThreads: SubmittableExtrinsic<"promise", SubmittableResult>[][],
  nodeIdx: number,
  testParams: TestParams
) {
  const sorted = preSetupThreads[nodeIdx].sort(function (a, b) {
    return (
      parseFloat(JSON.parse(a.toString()).signature.nonce) -
      parseFloat(JSON.parse(b.toString()).signature.nonce)
    );
  });

  const runNodeTxs = (i: number) =>
    new Promise<[number, number]>(async (resolve) => {
      const transaction = await sorted[i];
      const start = new Date().getTime();
      await transaction
        .send(({ status }) => {
          if (status.isFuture || status.isReady) {
            const finalized = new Date().getTime();
            const diff = finalized - start;
            resolve([i, diff]);
            logLine(
              testParams.logFile,
              "\n" +
                new Date().toUTCString() +
                "- Included - " +
                i +
                " - " +
                JSON.stringify(status.toHuman()!)
            );
            return;
          }
        })
        .catch((err: any) => {
          logLine(
            testParams.logFile,
            "\n" +
              new Date().toUTCString() +
              "- ERROR - " +
              JSON.stringify(err.toHuman()!)
          );
          testLog.getLog().warn(err);
          return -1;
        });
    });

  //is burst, so lets move the first tx to the end.
  //so right after all the Txs with node > the first one are submitted.
  const indexArray = sorted.map((_, index) => {
    return index;
  });
  testLog
    .getLog()
    .info(
      `Sending  in ${sorted.length} Threads ${preSetupThreads[0].length} Txs...`
    );

  await asyncPool(100, indexArray.slice(1), runNodeTxs);
  await asyncPool(1, [0], runNodeTxs);
  testLog.getLog().info(`.... Done`);
}

export async function runQuery(
  testParams: TestParams,
  preSetupThreads: SubmittableExtrinsic<"promise", SubmittableResult>[][]
) {
  const nodePromises = [];
  for (let nodeIdx = 0; nodeIdx < testParams.nodes.length; nodeIdx++) {
    const nodeThreads = testParams.threads;
    const runNodeTxs = (i: number) =>
      new Promise<[number, number]>(async (resolve) => {
        const transaction = preSetupThreads[nodeIdx][i];
        const start = new Date().getTime();
        await transaction;
        const finalized = new Date().getTime();
        const diff = finalized - start;
        resolve([i, diff]);
      });
    const nodeTxs = preSetupThreads[nodeIdx];
    const indexArray = nodeTxs.map((_, index) => {
      return index;
    });
    nodePromises.push(asyncPool(nodeThreads, indexArray, runNodeTxs));
  }
  const results = await Promise.all(nodePromises);
  // eslint-disable-next-line no-console
  console.info(
    "Test results \n --------- \n" +
      JSON.stringify(results) +
      "\n  ----------- Test results"
  );
  testLog.getLog().info("All promises fulfilled");
  return results;
}
