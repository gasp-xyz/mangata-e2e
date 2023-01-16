/*
 *
 * @group ui
 * @group ui-smoke
 */
import { Keyring } from "@polkadot/api";
import { BN } from "@polkadot/util";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";

import { Mangata } from "../../utils/frontend/pages/Mangata";

import { Sidebar } from "../../utils/frontend/pages/Sidebar";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  setupPolkadotExtension,
  acceptPermissionsPolkadotExtension,
  uiStringToBN,
} from "../../utils/frontend/utils/Helper";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars } from "../../utils/utils";

import { FIVE_MIN, MGA_ASSET_ID, MGA_ASSET_NAME, TUR_ASSET_ID, TUR_ASSET_NAME } from "../../utils/Constants";
import { testLog } from "../../utils/Logger";
import { Node } from "../../utils/Framework/Node/Node";
import { SudoUser } from "../../utils/Framework/User/SudoUser";
import { WalletConnectModal } from "../../utils/frontend/pages/WalletConnectModal";
import { Swap } from "../../utils/frontend/pages/Swap";
import { ModalType, NotificationModal } from "../../utils/frontend/pages/NotificationModal";
import { Polkadot } from "../../utils/frontend/pages/Polkadot";
import { waitNewBlock } from "../../utils/eventListeners";
import { Sudo } from "../../utils/sudo";
import { Assets } from "../../utils/Assets";
import { setAssetInfo } from "../../utils/txHandler";
import { setupApi } from "../../utils/setup";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe("UI tests - A user can swap and mint tokens", () => {
  let keyring: Keyring;
  let testUser1: User;
  let sudo: User;

  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });
  
  it("As a User I can Swap tokens - MGA - TUR", async () => {
    keyring = new Keyring({ type: "sr25519" });
    driver = await DriverBuilder.getInstance();
    const { mnemonic } = await setupPolkadotExtension(driver);
    const { sudo: sudoUserName } = getEnvironmentRequiredVars();
    sudo = new User(keyring, sudoUserName);
    keyring.addPair(sudo.keyRingPair);
    await setupApi();
    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(keyring, mnemonic);

    await Sudo.batchAsSudoFinalized(
      Assets.mintToken(TUR_ASSET_ID, testUser1),
      Assets.mintNative(testUser1),
    );

    await setAssetInfo(sudo, new BN(7), "TUR", "TUR", "", new BN(10));
    testUser1.addAsset(MGA_ASSET_ID);
    testUser1.addAsset(TUR_ASSET_ID);

    const mga = new Mangata(driver);
    await mga.go();
    const sidebar = new Sidebar(driver);
    const noWalletConnectedInfoDisplayed =
      await sidebar.isNoWalletConnectedInfoDisplayed();
    expect(noWalletConnectedInfoDisplayed).toBeTruthy();

    await sidebar.clickOnWalletConnect();
    const walletConnectModal = new WalletConnectModal(driver);
    const isWalletConnectModalDisplayed = await walletConnectModal.opens();
    expect(isWalletConnectModalDisplayed).toBeTruthy();
    await walletConnectModal.pickWallet("Polkadot");
    await acceptPermissionsPolkadotExtension(driver);
    await mga.go();
    await sidebar.clickOnWalletConnect();
    await walletConnectModal.pickWallet("Polkadot");
    await walletConnectModal.pickAccount("acc_automation");
    const isWalletConnected = sidebar.isWalletConnected("acc_automation");
    expect(isWalletConnected).toBeTruthy();

    testUser1.refreshAmounts(AssetWallet.BEFORE);

    const swapView = new Swap(driver);
    await swapView.toggleSwap();
    await swapView.selectPayAsset(MGA_ASSET_NAME);
    await swapView.selectGetAsset(TUR_ASSET_NAME);
    await swapView.addPayAssetAmount("0.001");
    await swapView.doSwap();
    const modal = new NotificationModal(driver);
    const isModalWaitingForSignVisible = await modal.isModalVisible(
      ModalType.Confirm
    );
    expect(isModalWaitingForSignVisible).toBeTruthy();
    await Polkadot.signTransaction(driver);
    //wait four blocks to complete the action.
    const visible: boolean[] = [];
    for (let index = 0; index < 4; index++) {
      visible.push(await modal.isModalVisible(ModalType.Progress));
      await waitNewBlock();
    }
    expect(
      visible.some((visibleInBlock) => visibleInBlock === true)
    ).toBeTruthy();
    const isModalSuccessVisible = await modal.isModalVisible(ModalType.Success);
    expect(isModalSuccessVisible).toBeTruthy();
    await modal.clickInDone();

    await testUser1.refreshAmounts(AssetWallet.AFTER);
    const swapped = testUser1
      .getAsset(TUR_ASSET_ID)
      ?.amountBefore.free!.lt(
        testUser1.getAsset(TUR_ASSET_ID)?.amountAfter.free!
      );
    const turValue = await swapView.getBalanceFromAssetGet();
    expect(testUser1.getAsset(TUR_ASSET_ID)?.amountAfter.free!).bnEqual(
      uiStringToBN(turValue)
    );
    expect(swapped).toBeTruthy();
  });

  afterEach(async () => {
    try {
      const session = await driver.getSession();
      await addExtraLogs(
        driver,
        expect.getState().currentTestName + " - " + session.getId()
      );
    } catch (error) {
      testLog.getLog().warn(error);
    } finally {
      await driver.quit();
      await DriverBuilder.destroy();
    }
  });

  afterAll(async () => {
    const api = getApi();
    await api.disconnect();
  });
});
