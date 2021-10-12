import { Keyring } from "@polkadot/api";
import { mnemonicGenerate } from "@polkadot/util-crypto";

import { testLog } from "../Logger";

import { promises as fs } from "fs";
import { Convert } from "../Config";

import { Node } from "./Node";
import { User } from "./User";
import { Token } from "./Token";

export class Network {
  private _keyring: Keyring | undefined;
  private _bootnode: Node | undefined;
  private _nodes: Array<Node> | undefined;
  private _users: Array<User> | undefined;
  private _tokens: Array<Token> | undefined;

  public getState() {
    return {
      nodes: this._nodes,
      bootnode: this._bootnode,
      users: this._users,
      tokens: this._tokens,
    };
  }

  public prettyPrintState() {
    testLog.getLog().info(`Bootnode:`);
    testLog.getLog().info(`${this._bootnode?.name}`);

    testLog.getLog().info(`Nodes:`);
    this._nodes!.forEach((node) => {
      testLog.getLog().info(`${node.prettyPrint()}`);
    });

    testLog.getLog().info(`Users:`);
    this._users!.forEach((user) => {
      testLog.getLog().info(`${user.name} - ${user.address}`);
    });

    testLog.getLog().info(`Tokens:`);
    this._tokens!.forEach((token) => {
      testLog.getLog().info(`${token.name} - ${token.supply}`);
    });
  }

  constructor() {
    this._keyring = new Keyring({ type: "sr25519" });
  }

  async init(filePath: string): Promise<void> {
    await fs.readFile(filePath, "utf-8").then((fileContents) => {
      const config = Convert.toTestConfig(fileContents);

      config.nodes.forEach((node) => {
        if (this._nodes === undefined) {
          this._nodes = [new Node(node.name, node.wsPath)];
        } else {
          this._nodes!.push(new Node(node.name, node.wsPath));
        }
      });

      this._bootnode = this._nodes![0];
      testLog.getLog().info(`Bootnode Name: ${this._bootnode.name}`);

      config.users.forEach((user) => {
        const newUser: User = new User(user.name);
        if (this._users === undefined) {
          this._users = [newUser];
        } else {
          this._users!.push(newUser);
        }
        newUser.account.mnemonic = mnemonicGenerate(12);
        newUser.account.keyringPair = this._keyring!.addFromMnemonic(
          newUser.account.mnemonic
        );
        newUser.address = newUser.account.keyringPair!.address;
      });

      config.tokens.forEach((token) => {
        if (this._tokens === undefined) {
          this._tokens = [new Token(token.name, token.supply, this._bootnode!)];
        } else {
          this._tokens!.push(
            new Token(token.name, token.supply, this._bootnode!)
          );
        }
      });
    });

    const promises = [];
    for (let index = 0; index < this._nodes!.length; index++) {
      const element = this._nodes![index];
      promises.push(element.connect());
    }
    await Promise.all(promises);

    for (let index = 0; index < this._nodes!.length; index++) {
      const element = this._nodes![index];
      promises.push(element.subscribeToHead());
    }
    await Promise.all(promises);
  }

  async createToken(): Promise<void> {}

  async fundUser(user: User): Promise<void> {}
}
