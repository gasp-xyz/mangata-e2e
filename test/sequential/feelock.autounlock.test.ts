/* eslint-disable jest/no-conditional-expect */
/*
 *
 * @group seqgasless
 */
import { Keyring } from "@polkadot/api";
import { getApi, initApi } from "../../utils/api";
import { Assets } from "../../utils/Assets";
import { BN } from "@mangata-finance/sdk";
import { setupApi, setupUsers } from "../../utils/setup";
import { Sudo } from "../../utils/sudo";
import { AssetWallet, User } from "../../utils/User";
import { sellAsset } from "../../utils/tx";
import { getEnvironmentRequiredVars, waitForNBlocks } from "../../utils/utils";
import { Xyk } from "../../utils/xyk";
import { ExtrinsicResult } from "../../utils/eventListeners";
import { getEventResultFromMangataTx } from "../../utils/txHandler";

jest.spyOn(console, "log").mockImplementation(jest.fn());
jest.setTimeout(2500000);
process.env.NODE_ENV = "test";

const { sudo: sudoUserName } = getEnvironmentRequiredVars();
let testUser1: User;
let sudo: User;
let keyring: Keyring;
let firstToken: BN;
let secondToken: BN;
const thresholdValue = new BN(1);
const periodLength = new BN(10);
const lockAmount = new BN("1000000000000000000000");
const millionNative = new BN("1000000000000000000000000");
const nativeCurrencyId = new BN(0);
const defaultCurrencyValue = new BN(10000000);
const defaultPoolVolumeValue = new BN(1000000);
const FREE_AND_RESERVED = false;

beforeAll(async () => {
  try {
    getApi();
  } catch (e) {
    await initApi();
  }
  keyring = new Keyring({ type: "sr25519" });

  // setup users
  sudo = new User(keyring, sudoUserName);
});

beforeEach(async () => {
  await setupApi();

  [testUser1] = setupUsers();

  [firstToken, secondToken] = await Assets.setupUserWithCurrencies(
    testUser1,
    [defaultCurrencyValue, defaultCurrencyValue],
    sudo
  );

  testUser1.addAsset(nativeCurrencyId)

  await Sudo.batchAsSudoFinalized(
    Assets.mintNative(testUser1, millionNative),
    Sudo.sudoAs(
      testUser1,
      Xyk.createPool(
        firstToken,
        defaultPoolVolumeValue,
        secondToken,
        defaultPoolVolumeValue,
      )
    ),
    Sudo.sudo(getApi().tx.feeLock.updateFeeLockMetadata(periodLength, lockAmount, thresholdValue, []))
  );
});

test("Mat test", async () => {

  await testUser1.refreshAmounts(AssetWallet.BEFORE);

  // act
  await sellAsset(testUser1.keyRingPair, firstToken, secondToken, new BN(10000), new BN(0)).then(
    (result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        testUser1.keyRingPair.address,
      ]);
      expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
    }
  );

  // assert
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  expect(testUser1.getAsset(nativeCurrencyId, FREE_AND_RESERVED)?.amountBefore!.reserved).bnEqual(new BN(0));
  expect(testUser1.getAsset(nativeCurrencyId, FREE_AND_RESERVED)?.amountAfter!.reserved).bnEqual(lockAmount);
  //
  await testUser1.refreshAmounts(AssetWallet.BEFORE);
  // wait until lock is automatically released
  await waitForNBlocks(periodLength.toNumber());
  await testUser1.refreshAmounts(AssetWallet.AFTER);

  expect(testUser1.getAsset(nativeCurrencyId, FREE_AND_RESERVED)!.amountBefore.reserved).bnEqual(lockAmount);
  expect(testUser1.getAsset(nativeCurrencyId, FREE_AND_RESERVED)!.amountAfter.reserved).bnEqual(new BN(0));


});
