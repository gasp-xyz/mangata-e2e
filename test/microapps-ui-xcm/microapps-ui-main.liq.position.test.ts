/*
 *
 * @group microappsXCM
 */
import { jest } from "@jest/globals";
import { Keyring } from "@polkadot/api";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  importPolkadotExtension,
} from "../../utils/frontend/utils/Helper";
import { AssetWallet, User } from "../../utils/User";
import { getEnvironmentRequiredVars, sleep } from "../../utils/utils";
import { KSM_ASSET_ID, MGA_ASSET_ID } from "../../utils/Constants";
import { Node } from "../../utils/Framework/Node/Node";
import "dotenv/config";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
  waitForMicroappsActionNotification,
} from "../../utils/frontend/microapps-utils/Handlers";
import { ApiContext } from "../../utils/Framework/XcmHelper";
import XcmNetworks from "../../utils/Framework/XcmNetworks";
import { connectVertical } from "@acala-network/chopsticks";
import { AssetId } from "../../utils/ChainSpecs";
import { BN_THOUSAND } from "@mangata-finance/sdk";
import StashServiceMockSingleton from "../../utils/stashServiceMockSingleton";
import { LiqPools } from "../../utils/frontend/microapps-pages/LiqPools";
import { Sidebar } from "../../utils/frontend/microapps-pages/Sidebar";
import {
  KSM_ASSET_NAME,
  MGX_ASSET_NAME,
} from "../../utils/frontend/microapps-pages/UiConstant";
import { LiqPoolDetils } from "../../utils/frontend/microapps-pages/LiqPoolDetails";
//import { Polkadot } from "../../utils/frontend/pages/Polkadot";
import { TransactionType } from "../../utils/frontend/microapps-pages/NotificationModal";
import { PositionModal } from "../../utils/frontend/microapps-pages/PositionModal";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;
let testUser1: User;

const acc_name = "acc_automation";
const userAddress = "5FeYEhdFzSQP6YWapPC6Myd17zdPba9CXmSptNSTh4Hz9cZ9";
const INIT_KSM_RELAY = 15;

describe("Microapps UI deposit modal tests", () => {
  let kusama: ApiContext;
  let mangata: ApiContext;

  beforeAll(async () => {
    kusama = await XcmNetworks.kusama({ localPort: 9944 });
    mangata = await XcmNetworks.mangata({ localPort: 9946 });
    await connectVertical(kusama.chain, mangata.chain);
    StashServiceMockSingleton.getInstance().startMock();

    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [[userAddress, { token: 4 }], { free: 10 * 1e12 }],
          [
            [userAddress, { token: 0 }],
            { free: AssetId.Mgx.unit.mul(BN_THOUSAND).toString() },
          ],
        ],
      },
      Sudo: {
        Key: userAddress,
      },
    });
    await kusama.dev.setStorage({
      System: {
        Account: [
          [
            [userAddress],
            { providers: 1, data: { free: INIT_KSM_RELAY * 1e12 } },
          ],
        ],
      },
    });

    driver = await DriverBuilder.getInstance();
    await importPolkadotExtension(driver);

    const keyring = new Keyring({ type: "sr25519" });
    const node = new Node(getEnvironmentRequiredVars().chainUri);
    await node.connect();

    testUser1 = new User(keyring);
    testUser1.addFromMnemonic(
      keyring,
      getEnvironmentRequiredVars().mnemonicPolkadot,
    );

    testUser1.addAsset(KSM_ASSET_ID);
    testUser1.addAsset(MGA_ASSET_ID);
    await testUser1.refreshAmounts(AssetWallet.BEFORE);

    await setupPage(driver);
    await connectWallet(driver, "Polkadot", acc_name);
  });

  it("Add pool liquidity", async () => {
    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavLiqPools();

    const poolsList = new LiqPools(driver);
    const isPoolsListDisplayed = await poolsList.isDisplayed();
    expect(isPoolsListDisplayed).toBeTruthy();

    const isMgxKsmPoolVisible = await poolsList.isPoolItemDisplayed(
      "-" + MGX_ASSET_NAME + "-" + KSM_ASSET_NAME,
    );
    expect(isMgxKsmPoolVisible).toBeTruthy();
    await poolsList.clickPoolItem("-" + MGX_ASSET_NAME + "-" + KSM_ASSET_NAME);

    const poolDetails = new LiqPoolDetils(driver);
    const isPoolDetailsVisible = await poolDetails.isDisplayed(
      MGX_ASSET_NAME + " / " + KSM_ASSET_NAME,
    );
    expect(isPoolDetailsVisible).toBeTruthy();

    await poolDetails.clickAddLiquidity();
    const isFirstTokenNameSet =
      await poolDetails.isFirstTokenNameSet(MGX_ASSET_NAME);
    expect(isFirstTokenNameSet).toBeTruthy();
    const isSecondTokenNameSet =
      await poolDetails.isSecondTokenNameSet(KSM_ASSET_NAME);
    expect(isSecondTokenNameSet).toBeTruthy();

    await poolDetails.setFirstTokenAmount("10");
    await poolDetails.waitSecondTokenAmountSet(true);
    const secondTokenAmount = await poolDetails.getSecondTokenAmount();
    expect(secondTokenAmount).toBeGreaterThan(0);
    await poolDetails.waitAddLiqBtnVisible();
    await poolDetails.clickSubmitLiquidity();
    await waitForMicroappsActionNotification(
      driver,
      mangata,
      kusama,
      TransactionType.AddLiquidity,
      2,
    );
  });

  it("Remove pool liquidity", async () => {
    await mangata.dev.setStorage({
      Tokens: {
        Accounts: [
          [[userAddress, { token: 5 }], { free: 10 * 1e12 }],
          [[userAddress, { token: 8 }], { free: 10 * 1e12 }],
        ],
      },
    });

    await setupPageWithState(driver, acc_name);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavPositions();
    await sleep(5000);

    const positionModal = new PositionModal(driver);
    await positionModal.isLiqPoolDisplayed(MGX_ASSET_NAME, KSM_ASSET_NAME);
    await positionModal.clickPromPoolPosition(MGX_ASSET_NAME, KSM_ASSET_NAME);
    await sleep(120000);
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId(),
    );
  });

  afterAll(async () => {
    StashServiceMockSingleton.getInstance().stopServer();
    await kusama.teardown();
    await mangata.teardown();
    const api = getApi();
    await api.disconnect();
    await driver.quit();
    DriverBuilder.destroy();
  });
});
