import { Keyring } from "@polkadot/api";
import BN from "bn.js";
import { getApi, initApi } from "../utils/api";
import { User } from "../utils/User";
import fs from "fs";
import { getNextAssetId, setAssetInfo } from "../utils/txHandler";
import { Assets } from "../utils/Assets";

require("dotenv").config();

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
process.env.NODE_ENV = "test";
let keyring;

describe("AssetInfo - testpad", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  const dot = "4";
  const btc = "5";
  const usd = "6";
  //develop-v4
  const sudoAddress = "5CthcoS3CYHoVHDMUacydayRLMzMWedKryjsrvzrmv3VHCKP";

  test("Add Assets info", async () => {
    const pathToFiles = "/home/goncer/projects/";
    keyring = new Keyring({ type: "sr25519" });
    const json = fs.readFileSync(pathToFiles + sudoAddress + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const sudo = new User(keyring, "sudo", JSON.parse(json));
    keyring.addPair(sudo.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    await sudo.addMGATokens(sudo);
    const nextAssetId = await getNextAssetId();
    const numberOfMissingTokens = 7 - nextAssetId.toNumber();

    if (numberOfMissingTokens > 0) {
      const tokens = Array.from(Array(7).keys())
        .reverse()
        .slice(0, numberOfMissingTokens);
      const assets = tokens.flatMap((x) => new BN(Math.pow(10, 20).toString()));
      await Assets.setupUserWithCurrencies(sudo, assets, sudo).then(
        (values) => {
          return values.map((val) => val.toNumber());
        }
      );
    }
    await setAssetInfo(
      sudo,
      new BN(dot),
      "mDOT",
      "mDOT",
      "0x20a9b8313e040e52b6176c8cfd46dea0e3c62763",
      new BN(18)
    );
    await setAssetInfo(
      sudo,
      new BN(btc),
      "mBTC",
      "mBTC",
      "0xb171e7c2316ecd042d1ea148cdd930ea484c37ac",
      new BN(18)
    );
    await setAssetInfo(
      sudo,
      new BN(usd),
      "mUSD",
      "mUSD",
      "0xc6f4f60fa2d578b2b83cde49b8be624bd439eb98",
      new BN(18)
    );
  });

  test("Send tokens to Alice, the MGA provider in airdrop", async () => {
    const pathToFiles = "/home/goncer/projects/";
    keyring = new Keyring({ type: "sr25519" });
    const json = fs.readFileSync(pathToFiles + sudoAddress + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const sudo = new User(keyring, "sudo", JSON.parse(json));
    keyring.addPair(sudo.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    const alice = new User(keyring, "//Alice");
    await alice.addMGATokens(sudo, new BN("10000000000000000000000000"));
  });

  test("Send tokens to Michal address", async () => {
    const pathToFiles = "/home/goncer/projects/";
    keyring = new Keyring({ type: "sr25519" });
    const json = fs.readFileSync(pathToFiles + sudoAddress + ".json", {
      encoding: "utf8",
      flag: "r",
    });
    const sudo = new User(keyring, "sudo", JSON.parse(json));
    keyring.addPair(sudo.keyRingPair);
    keyring.pairs[0].decodePkcs8("mangata123");
    const target = new User(keyring);
    target.addFromAddress(
      keyring,
      "5CP5sgWw94GoQCGvm4qeNgKTw41Scnk2F41uPe4SSAPVPoCU"
    );
    await sudo.mint(new BN(4), target, new BN(Math.pow(10, 20).toString()));
    await sudo.mint(new BN(5), target, new BN(Math.pow(10, 20).toString()));
    await sudo.mint(new BN(6), target, new BN(Math.pow(10, 20).toString()));
    await target.addMGATokens(sudo);
  });
});
