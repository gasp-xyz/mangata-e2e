/*
 *
 * @group rollupWallet
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  importMetamaskExtension,
} from "../../utils/frontend/utils/Helper";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";
import { KSM_ASSET_ID, MGA_ASSET_ID } from "../../utils/Constants";
import { Node } from "../../utils/Framework/Node/Node";
import "dotenv/config";
import { WalletWrapper } from "../../utils/frontend/microapps-pages/WalletWrapper";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
} from "../../utils/frontend/rollup-utils/Handlers";
import { WalletConnectModal } from "../../utils/frontend/rollup-pages/WalletConnectModal";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let testUser1: User;

let acc_addr = "";
let acc_addr_short = "";

describe("Microapps Prod UI wallet tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    driver = await DriverBuilder.getInstance();
    acc_addr = await importMetamaskExtension(driver);
    acc_addr_short = acc_addr.slice(-4).toLowerCase();

    const keyring = new Keyring({ type: "sr25519" });
    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();

    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(
      keyring,
      getEnvironmentRequiredVars().mnemonicMetaMask,
    );

    testUser1.addAsset(KSM_ASSET_ID);
    testUser1.addAsset(MGA_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await setupPage(driver);
    await connectWallet(driver, "Metamask", acc_addr_short);
  });

  test("User can connect and disconnect Metamask wallet", async () => {
    await setupPageWithState(driver, acc_addr_short);

    const walletWrapper = new WalletWrapper(driver);
    await walletWrapper.openWalletConnectionInfo();
    await walletWrapper.openWalletSettings();

    const walletModal = new WalletConnectModal(driver);
    const areAccountsDisplayed = await walletModal.accountsDisplayed();
    expect(areAccountsDisplayed).toBeTruthy();
    const isAccInfoDisplayed =
      await walletModal.isAccInfoDisplayed(acc_addr_short);
    expect(isAccInfoDisplayed).toBeTruthy();

    await walletModal.disconnect();
    const isWalletConnected = await walletWrapper.isWalletConnected();
    expect(isWalletConnected).toBeFalsy();
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId(),
    );
  });

  afterAll(async () => {
    const api = getApi();
    await api.disconnect();
    await driver.quit();
    DriverBuilder.destroy();
  });
});
