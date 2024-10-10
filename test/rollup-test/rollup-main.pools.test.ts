/*
 *
 * @group rollupPoolsDev
 */
import { jest } from "@jest/globals";
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import {
  addExtraLogs,
  importMetamaskExtension,
  waitForHttpCall,
} from "../../utils/frontend/utils/Helper";
import "dotenv/config";
import {
  connectWallet,
  setupPage,
  setupPageWithState,
} from "../../utils/frontend/rollup-utils/Handlers";
import { Sidebar } from "../../utils/frontend/rollup-pages/Sidebar";
import { LiqPools } from "../../utils/frontend/rollup-pages/LiqPools";
import { LiqPoolDetils } from "../../utils/frontend/rollup-pages/LiqPoolDetails";

jest.spyOn(console, "log").mockImplementation(jest.fn());

jest.setTimeout(1500000);
let driver: WebDriver;

let acc_addr = "";
let acc_addr_short = "";
const ETH_ASSET_NAME = "ETH";
const GASP_ASSET_NAME = "GASPV2";
const MARS_ASSET_NAME = "MARS";
const ETH_ORIGIN = "Ethereum";

describe("Gasp UI pools tests", () => {
  beforeAll(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }

    driver = await DriverBuilder.getInstance(true, true);
    acc_addr = await importMetamaskExtension(driver, true);
    acc_addr_short = acc_addr.slice(-4);

    await setupPage(driver);
    await connectWallet(driver, "MetaMask", acc_addr_short);
  });

  it("User can enter gasp native - eth pool details", async () => {
    await setupPageWithState(driver, acc_addr_short);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavLiqPools();
    const status = await waitForHttpCall(driver, "token/order-buckets", 20000);
    expect(status).toEqual(200);

    const poolsList = new LiqPools(driver);
    const isPoolsListDisplayed = await poolsList.isDisplayed();
    expect(isPoolsListDisplayed).toBeTruthy();

    const isPoolVisible = await poolsList.isPoolItemDisplayed(
      "-" + GASP_ASSET_NAME + "-" + ETH_ASSET_NAME,
    );
    expect(isPoolVisible).toBeTruthy();
    await poolsList.clickPoolItem("-" + GASP_ASSET_NAME + "-" + ETH_ASSET_NAME);

    const poolDetails = new LiqPoolDetils(driver);
    const isPoolDetailsVisible = await poolDetails.isDisplayed(
      GASP_ASSET_NAME + " / " + ETH_ASSET_NAME,
    );
    expect(isPoolDetailsVisible).toBeTruthy();

    const arePositionDetailsVisible =
      await poolDetails.arePositionDetialsDisplayed();
    expect(arePositionDetailsVisible).toBeTruthy();
    const isPoolHistoryDisplayed = await poolDetails.isPoolHistoryDisplayed();
    expect(isPoolHistoryDisplayed).toBeTruthy();
    const arePoolStatsDisplayed = await poolDetails.arePoolStatsDisplayed();
    expect(arePoolStatsDisplayed).toBeTruthy();
  });

  it("User can search pools list", async () => {
    await setupPageWithState(driver, acc_addr_short);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavLiqPools();
    const status = await waitForHttpCall(driver, "token/order-buckets", 20000);
    expect(status).toEqual(200);

    const poolsList = new LiqPools(driver);
    const isPoolsListDisplayed = await poolsList.isDisplayed();
    expect(isPoolsListDisplayed).toBeTruthy();

    let isPoolVisible = await poolsList.isPoolItemDisplayed(
      "-" + GASP_ASSET_NAME + "-" + ETH_ASSET_NAME,
    );
    expect(isPoolVisible).toBeTruthy();

    await poolsList.openSearch();
    await poolsList.inputSearch("MA");

    isPoolVisible = await poolsList.isPoolItemDisplayed(
      "-" + GASP_ASSET_NAME + "-" + ETH_ASSET_NAME,
      false,
    );
    expect(isPoolVisible).toBeFalsy();

    const isMarsPoolVisible = await poolsList.isPoolItemDisplayed(
      "-" + MARS_ASSET_NAME + "-" + ETH_ASSET_NAME,
    );
    expect(isMarsPoolVisible).toBeTruthy();
  });

  it("Create pool liquidity - rejected", async () => {
    await setupPageWithState(driver, acc_addr_short);
    const sidebar = new Sidebar(driver);
    await sidebar.clickNavLiqPools();
    const status = await waitForHttpCall(driver, "token/order-buckets", 20000);
    expect(status).toEqual(200);

    const poolsList = new LiqPools(driver);
    const isPoolsListDisplayed = await poolsList.isDisplayed();
    expect(isPoolsListDisplayed).toBeTruthy();

    const isPoolVisible = await poolsList.isPoolItemDisplayed(
      "-" + GASP_ASSET_NAME + "-" + ETH_ASSET_NAME,
    );
    expect(isPoolVisible).toBeTruthy();
    await poolsList.clickCreateLiquidity();

    const isCreatePoolModalDisplayed =
      await poolsList.isCreatePoolModalDisplayed();
    expect(isCreatePoolModalDisplayed).toBeTruthy();

    await poolsList.pickFirstToken(MARS_ASSET_NAME, ETH_ORIGIN);
    await poolsList.pickSecondToken(GASP_ASSET_NAME);
    await poolsList.setFirstTokenAmount("5.45");
    await poolsList.setSecondTokenAmount("0.9");

    const isExpectedShareDisplayed = await poolsList.isExpectedShareDisplayed();
    expect(isExpectedShareDisplayed).toBeTruthy();
    const isFeeDisplayed = await poolsList.isFeeDisplayed();
    expect(isFeeDisplayed).toBeTruthy();

    //waiting for button bugfix
    // await poolsList.clickPoolsButtonByAction(PoolsActionType.Network);
    // await acceptNetworkSwitchInNewWindow(driver);
    //await poolsList.clickPoolsButtonByAction(PoolsActionType.Create);

    // await waitForActionNotification(driver, TransactionType.CreatePool, true);
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
