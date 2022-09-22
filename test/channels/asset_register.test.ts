import { api, initApi } from "../../utils/api";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { User } from "../../utils/User";
import { Keyring } from "@polkadot/api";
import { AcalaNode } from "../../utils/Framework/Node/AcalaNode";
import { Utils } from "./Utils";

const { acalaUri } = getEnvironmentRequiredVars();
jest.setTimeout(1500000);
jest.spyOn(console, "log").mockImplementation(jest.fn());

let alice: User;
let acala: AcalaNode;

beforeAll(async () => {
  await initApi();
  acala = new AcalaNode(acalaUri);
  await acala.connect();

  const keyring = new Keyring({ type: "sr25519" });
  alice = new User(keyring, "//Alice");
});

test("asset register - register MGR on Acala", async () => {
  const tx = acala.api!.tx.assetRegistry.registerForeignAsset(
    Utils.assetLocation(2110, "0x00000000"),
    {
      name: "mangata",
      symbol: "MGR",
      decimals: 18,
      minimalBalance: Utils.amount(10, 18),
    }
  );
  await Utils.signAndSend(alice, acala.api!.tx.sudo.sudo(tx));
});

test("asset register - register LKSM on Mangata", async () => {
  //@ts-ignore
  const tx = api!.tx.assetRegistry.registerAsset(
    Utils.assetLocation(2000, "0x0083")
    //    {
    //      decimals: 12,
    //      name: "liquid kusama",
    //      symbol: "LKSM",
    //      existentialDeposit: Utils.amount(10, 9), // 1000MGX
    //      location: Utils.assetLocation(2000, "0x0083"),
    //    },
    //    null
  );
  await Utils.signAndSend(alice, api!.tx.sudo.sudo(tx));
});

test("register LKSM", async () => {
  const tx = api!.tx.assetRegistry.registerAsset(
    {
      decimals: 12,
      name: "KAR- 0x0083",
      symbol: "LKSM",
      existentialDeposit: 0,
      location: {
        V1: {
          parents: 1,
          interior: {
            X2: [
              {
                Parachain: 2000,
              },
              {
                GeneralKey: "0x0083",
              },
            ],
          },
        },
      },
    },
    9
  );

  await Utils.signAndSend(alice, api!.tx.sudo.sudo(tx));
});
