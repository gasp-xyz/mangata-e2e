import { WebDriver } from "selenium-webdriver";
import {
  areDisplayed,
  buildDataTestIdXpath,
  buildXpathByText,
  clickElement,
  isDisplayed,
  waitForElementVisible,
} from "../utils/Helper";

//SELECTORS
const MODAL_ROOT = "//*[@data-testid='selectAccountModal-bg']";
const MODAL_CONNECT = MODAL_ROOT + "//*[@data-testid='walletLoading']";
const MODAL_ACC_LIST = MODAL_ROOT + "//*[@data-testid='accountList']";
const MODAL_NO_EXT = MODAL_ROOT + "//header[contains(.,'got a wallet yet?')]";
const BTN_DISCONNECT = "undefined-disconnect";

export enum ModalType {
  Connect,
  AccountList,
  NoExtension,
}

export class WalletConnectModal {
  driver: WebDriver;

  constructor(driver: WebDriver) {
    this.driver = driver;
  }

  modalStage: Record<ModalType, string> = {
    [ModalType.Connect]: MODAL_CONNECT,
    [ModalType.AccountList]: MODAL_ACC_LIST,
    [ModalType.NoExtension]: MODAL_NO_EXT,
  };

  async displayed() {
    return await isDisplayed(this.driver, this.modalStage[ModalType.Connect]);
  }

  async accountsDisplayed() {
    return await isDisplayed(
      this.driver,
      this.modalStage[ModalType.AccountList],
    );
  }

  async waitForaccountsDisplayed() {
    await waitForElementVisible(
      this.driver,
      this.modalStage[ModalType.AccountList],
      25000,
    );
  }

  async isReqExtensionInfoDisplayed(walletName: string) {
    const listDataTestIds = [
      this.modalStage[ModalType.NoExtension],
      this.getAccountItemXpath(ModalType.NoExtension, walletName),
    ];
    return await areDisplayed(this.driver, listDataTestIds);
  }

  async pickAccount(accountName: string) {
    await clickElement(
      this.driver,
      this.getAccountItemXpath(ModalType.AccountList, accountName),
    );
  }

  private getAccountItemXpath(type: ModalType, buttonString: string) {
    return (
      this.modalStage[type] +
      `//*[@data-testid="accountList-item" and contains(.,'${buttonString}')]`
    );
  }

  async isAccInfoDisplayed(accName: string) {
    const xpath = MODAL_ACC_LIST + buildXpathByText(accName);
    return await isDisplayed(this.driver, xpath);
  }

  async disconnect() {
    const xpath = MODAL_ROOT + buildDataTestIdXpath(BTN_DISCONNECT);
    return await clickElement(this.driver, xpath);
  }
}
