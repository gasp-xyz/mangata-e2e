import { By, WebDriver } from "selenium-webdriver";
import {
  areDisplayed,
  buildDataTestIdXpath,
  buildXpathByText,
  clearText,
  clickElement,
  getAttribute,
  getText,
  isDisplayed,
  scrollIntoView,
  waitForElement,
  waitForElementStateInterval,
  waitInputValueSetInterval,
  writeText,
} from "../utils/Helper";

const DIV_HEADER = "header";
const DIV_POSITION_DETAILS = "position-details";
const DIV_POOL_HISTORY = "pool-liq-history";
const DIV_POOL_STATS = "pool-statistics";
const DIV_POOL_TVL = "tvl";
const DIV_POOL_VOLUME = "volume";
// const DIV_POOL_REWARDS = "monthly-rewards";
const BUTTON_ADD_LIQ = "add-liquidity";
const BUTTON_SUBMIT_LIQ = "submit-button";
const BUTTON_BACK = "back-button";
const MY_POOL_POSTION_AMNT = "my-pool-position-amount";
const ADD_LIQ_POOL_WIDGET = "provide-liquidity-widget";
const DIV_FIRST_TOKEN_CONTAINER = "firstToken-container";
const DIV_FIRST_TOKEN_INPUT = "firstToken-input";
const DIV_SECOND_TOKEN_CONTAINER = "secondToken-container";
const DIV_SECOND_TOKEN_INPUT = "secondToken-input";
const BTN_SUBMIT = "submit-button";
const POOL_SHARE = "poolShare";
const EST_REWARDS = "est-rewards";
const FEE = "fee";

export class LiqPoolDetils {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  async isDisplayed(pool: string) {
    const poolHeader =
      buildDataTestIdXpath(DIV_HEADER) + buildXpathByText(pool);
    const displayed = await isDisplayed(this.driver, poolHeader);
    return displayed;
  }

  async clickAddLiquidity() {
    const itemXpath = buildDataTestIdXpath(BUTTON_ADD_LIQ);
    await clickElement(this.driver, itemXpath);
  }

  async clickBackButton() {
    const itemXpath = buildDataTestIdXpath(BUTTON_BACK);
    await clickElement(this.driver, itemXpath);
  }

  async clickSubmitLiquidity() {
    const itemXpath = buildDataTestIdXpath(BUTTON_SUBMIT_LIQ);
    await clickElement(this.driver, itemXpath);
  }

  async waitAddLiqBtnVisible(timeout = 20000) {
    const itemXpath = buildDataTestIdXpath(BUTTON_SUBMIT_LIQ);
    const startTime = Date.now();
    const endTime = startTime + timeout;

    while (Date.now() < endTime) {
      try {
        const element = await this.driver.findElement(By.xpath(itemXpath));
        const isElementVisible = await element.isDisplayed();
        const buttonClass = await element.getAttribute("class");
        const buttonClassIncludes = buttonClass.includes("bg-btn-primary");
        if (isElementVisible && buttonClassIncludes) {
          return;
        }
      } catch (error) {
        // Element not found or other error occurred, continue waiting
      }
    }
  }

  async isAddLiqPoolWidgetVisible() {
    const itemXpath = buildDataTestIdXpath(ADD_LIQ_POOL_WIDGET);
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

  async getFirstTokenAmount() {
    const itemXpath =
      buildDataTestIdXpath(DIV_FIRST_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_FIRST_TOKEN_INPUT);
    const text = await getAttribute(this.driver, itemXpath);
    const floatValue = parseFloat(text);
    return floatValue;
  }

  async clearFirstTokenAmount() {
    const itemXpath =
      buildDataTestIdXpath(DIV_FIRST_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_FIRST_TOKEN_INPUT);
    await clearText(this.driver, itemXpath);
  }

  async isFirstTokenNameSet(name: string) {
    const itemXpath =
      buildDataTestIdXpath(DIV_FIRST_TOKEN_CONTAINER) + buildXpathByText(name);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async setSecondTokenAmount(amount: string) {
    const itemXpath =
      buildDataTestIdXpath(DIV_SECOND_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_SECOND_TOKEN_INPUT);
    await clickElement(this.driver, itemXpath);
    await writeText(this.driver, itemXpath, amount);
  }

  async getSecondTokenAmount() {
    const itemXpath =
      buildDataTestIdXpath(DIV_SECOND_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_SECOND_TOKEN_INPUT);
    const text = await getAttribute(this.driver, itemXpath);
    const floatValue = parseFloat(text);
    return floatValue;
  }

  async clearSecondTokenAmount() {
    const itemXpath =
      buildDataTestIdXpath(DIV_SECOND_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_SECOND_TOKEN_INPUT);
    await clearText(this.driver, itemXpath);
  }

  async isSecondTokenNameSet(name: string) {
    const itemXpath =
      buildDataTestIdXpath(DIV_SECOND_TOKEN_CONTAINER) + buildXpathByText(name);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async waitSecondTokenAmountSet(isSet: boolean, timeout = 5000) {
    const itemXpath =
      buildDataTestIdXpath(DIV_SECOND_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_SECOND_TOKEN_INPUT);
    await waitInputValueSetInterval(this.driver, itemXpath, isSet, timeout);
  }

  async waitFirstTokenAmountSet(isSet: boolean, timeout = 5000) {
    const itemXpath =
      buildDataTestIdXpath(DIV_FIRST_TOKEN_CONTAINER) +
      buildDataTestIdXpath(DIV_FIRST_TOKEN_INPUT);
    await waitInputValueSetInterval(this.driver, itemXpath, isSet, timeout);
  }

  async waitForContinueState(isEnabled: boolean, timeout = 5000) {
    const continueBtn =
      buildDataTestIdXpath(ADD_LIQ_POOL_WIDGET) +
      buildDataTestIdXpath(BTN_SUBMIT);
    await scrollIntoView(this.driver, continueBtn);
    await waitForElementStateInterval(
      this.driver,
      continueBtn,
      isEnabled,
      timeout,
    );
  }

  async submit() {
    const continueBtn =
      buildDataTestIdXpath(ADD_LIQ_POOL_WIDGET) +
      buildDataTestIdXpath(BTN_SUBMIT);
    await scrollIntoView(this.driver, continueBtn);
    await clickElement(this.driver, continueBtn);
  }

  async isExpectedShareDisplayed() {
    const itemXpath =
      buildDataTestIdXpath(ADD_LIQ_POOL_WIDGET) +
      buildDataTestIdXpath(POOL_SHARE);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async isFeeDisplayed() {
    const itemXpath =
      buildDataTestIdXpath(ADD_LIQ_POOL_WIDGET) + buildDataTestIdXpath(FEE);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async isEstRewardDisplayed() {
    const itemXpath =
      buildDataTestIdXpath(ADD_LIQ_POOL_WIDGET) +
      buildDataTestIdXpath(EST_REWARDS);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async isMyPositionAmountDisplayed() {
    const itemXpath = buildDataTestIdXpath(MY_POOL_POSTION_AMNT);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async getMyPositionAmount() {
    const itemXpath = buildDataTestIdXpath(MY_POOL_POSTION_AMNT);
    const text = await getText(this.driver, itemXpath);
    const floatValue = parseFloat(text);
    return floatValue;
  }

  async isFirstTokenAlert() {
    const alertState =
      buildDataTestIdXpath(DIV_FIRST_TOKEN_CONTAINER) +
      "//*[contains(@class, 'text-alert')]";
    return await isDisplayed(this.driver, alertState);
  }

  async isSecondTokenAlert() {
    const alertState =
      buildDataTestIdXpath(DIV_SECOND_TOKEN_CONTAINER) +
      "//*[contains(@class, 'text-alert')]";
    return await isDisplayed(this.driver, alertState);
  }

  async arePositionDetialsDisplayed() {
    const itemXpath = buildDataTestIdXpath(DIV_POSITION_DETAILS);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async isPoolHistoryDisplayed() {
    const itemXpath = buildDataTestIdXpath(DIV_POOL_HISTORY);
    await scrollIntoView(this.driver, itemXpath);
    const displayed = await isDisplayed(this.driver, itemXpath);
    return displayed;
  }

  async arePoolStatsDisplayed() {
    const poolStats = buildDataTestIdXpath(DIV_POOL_STATS);
    await waitForElement(this.driver, poolStats);

    const tvl = poolStats + buildDataTestIdXpath(DIV_POOL_TVL);
    const volume = poolStats + buildDataTestIdXpath(DIV_POOL_VOLUME);
    //const rewards = poolStats + buildDataTestIdXpath(DIV_POOL_REWARDS);

    const displayed = await areDisplayed(this.driver, [
      tvl,
      volume,
      //rewards,
      poolStats,
    ]);
    return displayed;
  }
}
