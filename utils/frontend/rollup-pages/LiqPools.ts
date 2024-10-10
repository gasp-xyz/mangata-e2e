import { By, WebDriver } from "selenium-webdriver";
import {
  buildClassXpath,
  buildDataTestIdXpath,
  buildXpathByElementText,
  buildXpathByMultiText,
  clearText,
  clickElement,
  isDisplayed,
  scrollIntoView,
  waitForElement,
  waitForElementStateInterval,
  waitForElementVisible,
  writeText,
} from "../utils/Helper";

const SEARCH_CONTAINER = "pool-list-search-container";
const SEARCH_INPUT = "pool-list-search-input";
const TAB_PROMOTED_POOLS = "Promoted-Pools-item";
const TAB_ALL_POOLS = "All-Pools-item";
const CREATE_LIQUIDITY_WIDGET = "provide-liquidity-widget";
const BTN_SELECT_FIRST_TOKEN = "firstToken-selector-btn";
const BTN_SELECT_SECOND_TOKEN = "secondToken-selector-btn";
const BTN_POOL_CREATE = "pool-create";
const DIV_FIRST_TOKEN_SELECTOR_CONTENT = "firstToken-selector-content";
const DIV_SECOND_TOKEN_SELECTOR_CONTENT = "secondToken-selector-content";
const DIV_TOKEN_SELECTOR_ITEM = "tokenList-item";
const DIV_FIRST_TOKEN_CONTAINER = "firstToken-container";
const DIV_FIRST_TOKEN_INPUT = "firstToken-input";
const DIV_SECOND_TOKEN_CONTAINER = "secondToken-container";
const DIV_SECOND_TOKEN_INPUT = "secondToken-input";
const POOL_SHARE = "poolShare";
const EST_REWARDS = "est-rewards";
const FEE = "fee";
const BTN_SUBMIT = "submit-button";
const BTN_CANCEL = "cancel-button";
const POOLS_ROW = "pools-row";
const PROVIDE_LIQ_MODAL = "provide-liquidity-modal-content";

export enum PoolsActionType {
  Add,
  Create,
  Network,
}

export class LiqPools {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  poolsAction: Record<PoolsActionType, string> = {
    [PoolsActionType.Add]: "Add liquidity",
    [PoolsActionType.Create]: "Create pool",
    [PoolsActionType.Network]: "Switch to Holesky",
  };

  async isDisplayed() {
    const search = buildDataTestIdXpath(SEARCH_CONTAINER);
    const displayed = await isDisplayed(this.driver, search);
    return displayed;
  }

  async isPoolItemDisplayed(pool: string, visible = true) {
    const itemXpath = buildDataTestIdXpath(POOLS_ROW + pool);
    if (visible) {
      await waitForElementStateInterval(this.driver, itemXpath, true);
    }
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async isCreatePoolModalDisplayed(visible = true) {
    const itemXpath = buildDataTestIdXpath(PROVIDE_LIQ_MODAL);
    if (visible) {
      await waitForElementStateInterval(this.driver, itemXpath, true);
    }
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async clickPoolItem(pool: string) {
    const itemXpath = buildDataTestIdXpath(POOLS_ROW + pool);
    await scrollIntoView(this.driver, itemXpath);
    await clickElement(this.driver, itemXpath);
  }

  async clickPromotedPoolsTab() {
    const itemXpath = buildDataTestIdXpath(TAB_PROMOTED_POOLS);
    await clickElement(this.driver, itemXpath);
  }

  async clickAllPoolsTab() {
    const itemXpath = buildDataTestIdXpath(TAB_ALL_POOLS);
    await clickElement(this.driver, itemXpath);
  }

  async clickCreateLiquidity() {
    const itemXpath = buildDataTestIdXpath(BTN_POOL_CREATE);
    await clickElement(this.driver, itemXpath);
  }

  async isPoolExistsInfoDisplayed() {
    const itemXpath = buildXpathByElementText(
      "span",
      "selected pool already exists",
    );
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async openSearch() {
    const itemXpath = buildDataTestIdXpath(SEARCH_CONTAINER);
    await clickElement(this.driver, itemXpath);
  }

  async inputSearch(text: string) {
    const inputSearch = buildDataTestIdXpath(SEARCH_INPUT);
    await clickElement(this.driver, inputSearch);
    await writeText(this.driver, inputSearch, text);
  }

  async isCreateLiqPoolWidgetVisible() {
    const itemXpath = buildDataTestIdXpath(CREATE_LIQUIDITY_WIDGET);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async setFirstTokenAmount(amount: string) {
    const itemXpath =
      buildDataTestIdXpath(DIV_FIRST_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_FIRST_TOKEN_INPUT);
    await clickElement(this.driver, itemXpath);
    await writeText(this.driver, itemXpath, amount);
  }

  async clearFirstTokenAmount() {
    const itemXpath =
      buildDataTestIdXpath(DIV_FIRST_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_FIRST_TOKEN_INPUT);
    await clearText(this.driver, itemXpath);
  }

  async setSecondTokenAmount(amount: string) {
    const itemXpath =
      buildDataTestIdXpath(DIV_SECOND_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_SECOND_TOKEN_INPUT);
    await clickElement(this.driver, itemXpath);
    await writeText(this.driver, itemXpath, amount);
  }

  async clearSecondTokenAmount() {
    const itemXpath =
      buildDataTestIdXpath(DIV_SECOND_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_SECOND_TOKEN_INPUT);
    await clearText(this.driver, itemXpath);
  }

  async isExpectedShareDisplayed() {
    const itemXpath =
      buildDataTestIdXpath(CREATE_LIQUIDITY_WIDGET) +
      buildDataTestIdXpath(POOL_SHARE);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async isFeeDisplayed() {
    const itemXpath =
      buildDataTestIdXpath(CREATE_LIQUIDITY_WIDGET) + buildDataTestIdXpath(FEE);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async isEstRewardDisplayed() {
    const itemXpath =
      buildDataTestIdXpath(CREATE_LIQUIDITY_WIDGET) +
      buildDataTestIdXpath(EST_REWARDS);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async createLiqPoolsubmit() {
    const continueBtn =
      buildDataTestIdXpath(CREATE_LIQUIDITY_WIDGET) +
      buildDataTestIdXpath(BTN_SUBMIT);
    await scrollIntoView(this.driver, continueBtn);
    await clickElement(this.driver, continueBtn);
  }

  async waitForContinueState(isEnabled: boolean, timeout = 5000) {
    const continueBtn =
      buildDataTestIdXpath(CREATE_LIQUIDITY_WIDGET) +
      buildDataTestIdXpath(BTN_SUBMIT);
    await scrollIntoView(this.driver, continueBtn);
    await waitForElementStateInterval(
      this.driver,
      continueBtn,
      isEnabled,
      timeout,
    );
  }

  async clickCancelButton() {
    const itemXpath = buildDataTestIdXpath(BTN_CANCEL);
    await clickElement(this.driver, itemXpath);
  }

  async getPoolsList() {
    const classNameXpath = await buildClassXpath("focus:outline-0 group");
    await waitForElementVisible(this.driver, classNameXpath, 15000);
    const fePoolsInfo = await this.driver.findElements(
      By.xpath(classNameXpath),
    );
    const fePoolsNumber = fePoolsInfo.length;
    const fePoolsList = [];
    for (let i = 0; i < fePoolsNumber; i++) {
      const dataTestId = await fePoolsInfo[i].getAttribute("data-testid");
      fePoolsList.push(dataTestId);
    }
    return fePoolsList;
  }

  async pickFirstToken(tokenName: string, origin = "Native") {
    const selectFirstToken = buildDataTestIdXpath(BTN_SELECT_FIRST_TOKEN);
    await clickElement(this.driver, selectFirstToken);
    const firstTokenSelector = buildDataTestIdXpath(
      DIV_FIRST_TOKEN_SELECTOR_CONTENT,
    );
    await waitForElement(this.driver, firstTokenSelector);
    const firstTokenSelectorButton =
      buildDataTestIdXpath(DIV_TOKEN_SELECTOR_ITEM) +
      buildXpathByMultiText([tokenName, origin]);
    await scrollIntoView(this.driver, firstTokenSelectorButton);
    await clickElement(this.driver, firstTokenSelectorButton);
  }

  async pickSecondToken(tokenName: string, origin = "Native") {
    const selectSecondToken = buildDataTestIdXpath(BTN_SELECT_SECOND_TOKEN);
    await clickElement(this.driver, selectSecondToken);
    const secondTokenSelector = buildDataTestIdXpath(
      DIV_SECOND_TOKEN_SELECTOR_CONTENT,
    );
    await waitForElement(this.driver, secondTokenSelector);
    const secondTokenSelectorButton =
      buildDataTestIdXpath(DIV_TOKEN_SELECTOR_ITEM) +
      buildXpathByMultiText([tokenName, origin]);
    await scrollIntoView(this.driver, secondTokenSelectorButton);
    await clickElement(this.driver, secondTokenSelectorButton);
  }

  async clickPoolsButtonByAction(action: PoolsActionType) {
    const xpath = buildXpathByElementText("button", this.poolsAction[action]);
    await clickElement(this.driver, xpath);
  }
}
