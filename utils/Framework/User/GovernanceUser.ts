import { ApiPromise } from "@polkadot/api";
import Keyring from "@polkadot/keyring";
import { ExtrinsicResult } from "../../eventListeners";
import {
  getCurrentNonce,
  getEventResultFromTxWait,
  signAndWaitTx,
} from "../../txHandler";
import { BaseUser } from "./BaseUser";
import { Node } from "../Node/Node";

export class GovernanceUser extends BaseUser {
  node: Node;
  api: ApiPromise;

  constructor(keyring: Keyring, name: string, json: any, node: Node) {
    super(keyring, name, json);
    this.node = node;
    this.api = node.api!;
  }

  async runForCouncil(): Promise<void> {
    await signAndWaitTx(
      this.api.tx.elections.submitCandidacy(
        (
          await this.api.query.elections.candidates()
        ).length
      ),
      this.keyRingPair.address,
      await getCurrentNonce(this.keyRingPair.address)
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        // Events we need to filter for
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
  }

  async vote(users: [BaseUser], stake: number): Promise<void> {
    const userAddresses: string[] = [];

    users.forEach((user) => {
      userAddresses.push(user.keyRingPair.address);
    });

    await signAndWaitTx(
      this.api.tx.elections
        .vote(userAddresses, stake)
        .signAndSend(this.keyRingPair),
      this.keyRingPair.address,
      await getCurrentNonce(this.keyRingPair.address)
    ).then((result) => {
      const eventResponse = getEventResultFromTxWait(result, [
        // Events we need to filter for
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    });
  }
}
