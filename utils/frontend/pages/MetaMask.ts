import { WebDriver } from "selenium-webdriver";
import { getEnvironmentRequiredVars, sleep } from "../../utils";
import {
  appendText,
  buildClassXpath,
  buildDataTestIdXpath,
  buildXpathByElementText,
  clearTextManual,
  clickElement,
  doActionInDifferentWindow,
  getText,
  isDisplayed,
  scrollIntoView,
  waitForElement,
  waitForElementEnabled,
  waitForElementToDissapear,
  waitForElementVisible,
  writeText,
} from "../utils/Helper";

//locators
const IMPUT_MNEMONIC_FIELD = "import-srp__srp-word-";
const BTN_IMPORT_SUBMIT = "import-srp-confirm";
const INPUT_PASS_NEW = "create-password-new";
const INPUT_PASS_CONFIRM = "create-password-confirm";
const CHECKBOX_PASS_TERMS = "create-password-terms";
const BTN_CREATE_PASS_SUBMIT = "create-password-wallet";
const BTN_SECURE_LATER = "secure-wallet-later";
const CHECKBOX_SECURE_LATER = "skip-srp-backup-popover-checkbox";
const BTN_SKIP_SRP = "skip-srp-backup";
const BTN_IMPORT_DONE = "onboarding-complete-done";
const BTN_PIN_EXT_NEXT = "pin-extension-next";
const BTN_PIN_EXT_DONE = "pin-extension-done";
const CHECKBOX_TERMS_POPOVER = "terms-of-use-checkbox";
const BTN_TERMS_POPOVER_ACCEPT = "terms-of-use-accept-button";
const BTN_ACCOUNT_OPTIONS = "account-options-menu-button";
const BTN_ACCOUNT_DETAILS = "account-list-menu-details";
const BTN_ACCOUNT_LABEL = "editable-label-button";
const DIV_ACCOUNT_LABEL_INPUT = "editable-input";
const BTN_CONNECT_ACCOUNT = "page-container-footer-next";
const BTN_ACC_SELECTION = "account-menu-icon";
const BTN_IMPORT_ACCOUNT = "multichain-account-menu-popover-action-button";
const BTN_IMPORT_ACCOUNT_CONFIRM = "import-account-confirm-button";
const BTN_FOOTER_NEXT = "page-container-footer-next";
const BTN_GENERIC_CONFIRMATION = "confirmation-submit-button";
const BTN_CONFIRM_TRANSACTION = "confirm-footer-confirm-button";
const BTN_REJECT_TRANSACTION = "page-container-footer-cancel";
let originalWindowHandle: string;

export class MetaMask {
  WEB_UI_ACCESS_URL =
    "chrome-extension://mgmaidbjhpkihbbdppiimfibmgehjkgb/home.html";

  private static instance: MetaMask;
  private constructor(driver: WebDriver) {
    this.driver = driver;
    const {
      uiUserPassword: userPassword,
      mnemonicMetaMask,
      privKeyMetaMask,
    } = getEnvironmentRequiredVars();
    this.userPassword = userPassword;
    this.mnemonicMetaMask = mnemonicMetaMask;
    this.privKeyMetaMask = privKeyMetaMask;
    this.acc_name = "acc_automation";
  }

  private driver: any;
  userPassword: string;
  mnemonicMetaMask: string;
  acc_name: string;
  privKeyMetaMask: string;

  public static getInstance(driver: WebDriver): MetaMask {
    if (!MetaMask.instance) {
      MetaMask.instance = new MetaMask(driver);
    }
    return MetaMask.instance;
  }
  async go() {
    await this.driver.get(this.WEB_UI_ACCESS_URL);
  }

  static async openMetaMaskInNewTab(driver: WebDriver) {
    originalWindowHandle = await driver.getWindowHandle();
    await driver.executeScript("window.open()");
    const handles = await driver.getAllWindowHandles();
    // Switch to the newly opened tab (last in the list of handles)
    await driver.switchTo().window(handles[handles.length - 1]);
    await MetaMask.getInstance(driver).go();
    await sleep(3000);
  }

  static async switchBackToOriginalTab(driver: WebDriver) {
    if (originalWindowHandle) {
        await driver.switchTo().window(originalWindowHandle);
    } else {
        console.warn('Original window handle not found.');
    }
}

  async setupAccount(mnemonicKeys = this.mnemonicMetaMask): Promise<string> {
    await this.driver.get(
      `${this.WEB_UI_ACCESS_URL}#onboarding/import-with-recovery-phrase`,
    );

    const XPATH_FIRST_WORD = buildDataTestIdXpath(IMPUT_MNEMONIC_FIELD + 0);
    await waitForElement(this.driver, XPATH_FIRST_WORD);

    // try {
    //   await this.closeAnyExtraWindow(this.driver);
    // } catch (e) {
    //   //no window to close
    // }

    await this.fillPassPhrase(mnemonicKeys);

    const XPATH_IMPORT_SUBMIT = buildDataTestIdXpath(BTN_IMPORT_SUBMIT);
    await clickElement(this.driver, XPATH_IMPORT_SUBMIT);

    await this.fillUserPass();

    const XPATH_PASS_TERMS = buildDataTestIdXpath(CHECKBOX_PASS_TERMS);
    await clickElement(this.driver, XPATH_PASS_TERMS);

    const XPATH_CREATE_PASS_SUBMIT = buildDataTestIdXpath(
      BTN_CREATE_PASS_SUBMIT,
    );
    await clickElement(this.driver, XPATH_CREATE_PASS_SUBMIT);

    const XPATH_BTN_SECURE_LATER = buildDataTestIdXpath(BTN_SECURE_LATER);
    if (await isDisplayed(this.driver, XPATH_BTN_SECURE_LATER)) {
      await this.skipBackup();
    }

    const XPATH_BTN_IMPORT_DONE = buildDataTestIdXpath(BTN_IMPORT_DONE);
    await clickElement(this.driver, XPATH_BTN_IMPORT_DONE);
    const XPATH_BTN_PIN_EXT_NEXT = buildDataTestIdXpath(BTN_PIN_EXT_NEXT);
    await clickElement(this.driver, XPATH_BTN_PIN_EXT_NEXT);
    const XPATH_BTN_PIN_EXT_DONE = buildDataTestIdXpath(BTN_PIN_EXT_DONE);
    await clickElement(this.driver, XPATH_BTN_PIN_EXT_DONE);

    const XPATH_BTN_NO_ENCHANCED_PROTECTION = buildXpathByElementText(
      "button",
      "Don't enable enhanced protection",
    );

    if (await isDisplayed(this.driver, XPATH_BTN_NO_ENCHANCED_PROTECTION)) {
      await clickElement(this.driver, XPATH_BTN_NO_ENCHANCED_PROTECTION);
    }

    await this.acceptTNC();
    await this.skipPopup();

    await this.openAccountDetails();
    const address = await this.getAddress();
    await this.changeAccountName(this.acc_name);

    return address;
  }

  async setupAccountPrivKey(
    mnemonicKeys = this.mnemonicMetaMask,
    privKey = this.privKeyMetaMask,
  ): Promise<string> {
    await this.driver.get(
      `${this.WEB_UI_ACCESS_URL}#onboarding/import-with-recovery-phrase`,
    );

    const XPATH_FIRST_WORD = buildDataTestIdXpath(IMPUT_MNEMONIC_FIELD + 0);
    await waitForElement(this.driver, XPATH_FIRST_WORD);

    // not needed anymore
    // try {
    //   await this.closeAnyExtraWindow(this.driver);
    // } catch (e) {
    //   //no window to close
    // }

    await this.fillPassPhrase(mnemonicKeys);

    const XPATH_IMPORT_SUBMIT = buildDataTestIdXpath(BTN_IMPORT_SUBMIT);
    await clickElement(this.driver, XPATH_IMPORT_SUBMIT);

    await this.fillUserPass();

    const XPATH_PASS_TERMS = buildDataTestIdXpath(CHECKBOX_PASS_TERMS);
    await clickElement(this.driver, XPATH_PASS_TERMS);

    const XPATH_CREATE_PASS_SUBMIT = buildDataTestIdXpath(
      BTN_CREATE_PASS_SUBMIT,
    );
    await clickElement(this.driver, XPATH_CREATE_PASS_SUBMIT);

    const XPATH_BTN_SECURE_LATER = buildDataTestIdXpath(BTN_SECURE_LATER);
    if (await isDisplayed(this.driver, XPATH_BTN_SECURE_LATER)) {
      await this.skipBackup();
    }

    const XPATH_BTN_IMPORT_DONE = buildDataTestIdXpath(BTN_IMPORT_DONE);
    await clickElement(this.driver, XPATH_BTN_IMPORT_DONE);
    const XPATH_BTN_PIN_EXT_NEXT = buildDataTestIdXpath(BTN_PIN_EXT_NEXT);
    await clickElement(this.driver, XPATH_BTN_PIN_EXT_NEXT);
    const XPATH_BTN_PIN_EXT_DONE = buildDataTestIdXpath(BTN_PIN_EXT_DONE);
    await clickElement(this.driver, XPATH_BTN_PIN_EXT_DONE);

    const XPATH_BTN_NO_ENCHANCED_PROTECTION = buildXpathByElementText(
      "button",
      "Don't enable enhanced protection",
    );

    if (await isDisplayed(this.driver, XPATH_BTN_NO_ENCHANCED_PROTECTION)) {
      await clickElement(this.driver, XPATH_BTN_NO_ENCHANCED_PROTECTION);
    }

    await this.acceptTNC();
    await this.skipPopup();

    await this.openAccountSelection();
    await this.importAccount(privKey);
    await this.openAccountDetails();
    const address = await this.getAddress();
    await this.changeAccountName(this.acc_name);

    return address;
  }

  async fillPassPhrase(phrase: string) {
    const words = phrase.split(" ");
    for (let i = 0; i < words.length; i++) {
      const xpath = buildDataTestIdXpath(IMPUT_MNEMONIC_FIELD + i);
      await writeText(this.driver, xpath, words[i]);
    }
  }

  async changeAccountName(accountName: string) {
    const XPATH_BTN_ACCOUNT_LABEL = buildDataTestIdXpath(BTN_ACCOUNT_LABEL);
    await clickElement(this.driver, XPATH_BTN_ACCOUNT_LABEL);
    const XPATH_DIV_ACCOUNT_LABEL_INPUT =
      buildDataTestIdXpath(DIV_ACCOUNT_LABEL_INPUT) + "//input";
    await clearTextManual(this.driver, XPATH_DIV_ACCOUNT_LABEL_INPUT);
    await appendText(this.driver, XPATH_DIV_ACCOUNT_LABEL_INPUT, accountName);
    const XPATH_BTN_ACCOUNT_LABEL_CONFIRM =
      "//*[contains(@style, 'check.svg')]";
    await clickElement(this.driver, XPATH_BTN_ACCOUNT_LABEL_CONFIRM);
  }

  async getAddress(): Promise<string> {
    return await getText(this.driver, "//*[@class='qr-code']/*[2]");
  }

  async openAccountDetails() {
    const XPATH_BTN_ACCOUNT_OPTIONS = buildDataTestIdXpath(BTN_ACCOUNT_OPTIONS);
    await clickElement(this.driver, XPATH_BTN_ACCOUNT_OPTIONS);
    const XPATH_BTN_ACCOUNT_DETAILS = buildDataTestIdXpath(BTN_ACCOUNT_DETAILS);
    await clickElement(this.driver, XPATH_BTN_ACCOUNT_DETAILS);
  }

  async openAccountSelection() {
    const XPATH_BTN_ACC_SELECTIONS = buildDataTestIdXpath(BTN_ACC_SELECTION);
    await clickElement(this.driver, XPATH_BTN_ACC_SELECTIONS);
  }

  async importAccount(privKey: string) {
    const XPATH_BTN_IMPORT_ACCOUNT = buildDataTestIdXpath(BTN_IMPORT_ACCOUNT);
    await clickElement(this.driver, XPATH_BTN_IMPORT_ACCOUNT);
    const XPATH_IMPORT_WITH_PK = buildXpathByElementText(
      "button",
      "Import account",
    );
    await clickElement(this.driver, XPATH_IMPORT_WITH_PK);
    const XPATH_INPUT_PRIV_KEY = "//input[@id='private-key-box']";
    await writeText(this.driver, XPATH_INPUT_PRIV_KEY, privKey);
    const XPATH_BTN_IMPORT_ACCOUNT_CONFIRM = buildDataTestIdXpath(
      BTN_IMPORT_ACCOUNT_CONFIRM,
    );
    await clickElement(this.driver, XPATH_BTN_IMPORT_ACCOUNT_CONFIRM);
    await waitForElementToDissapear(
      this.driver,
      XPATH_BTN_IMPORT_ACCOUNT_CONFIRM,
    );
  }

  async fillUserPass() {
    const XPATH_PASS_NEW = buildDataTestIdXpath(INPUT_PASS_NEW);
    const XPATH_PASS_CONFIRM = buildDataTestIdXpath(INPUT_PASS_CONFIRM);
    await writeText(this.driver, XPATH_PASS_NEW, this.userPassword);
    await writeText(this.driver, XPATH_PASS_CONFIRM, this.userPassword);
  }

  async skipBackup() {
    const XPATH_BTN_SECURE_LATER = buildDataTestIdXpath(BTN_SECURE_LATER);
    const XPATH_CHECKBOX_SECURE_LATER = buildDataTestIdXpath(
      CHECKBOX_SECURE_LATER,
    );
    const XPATH_BTN_SKIP_SRP = buildDataTestIdXpath(BTN_SKIP_SRP);
    await clickElement(this.driver, XPATH_BTN_SECURE_LATER);
    await clickElement(this.driver, XPATH_CHECKBOX_SECURE_LATER);
    await clickElement(this.driver, XPATH_BTN_SKIP_SRP);
  }

  async skipPopup() {
    const XPATH_DIV_POPOVER_CONTENT = "//*[@id='popover-content']";
    await waitForElementVisible(this.driver, XPATH_DIV_POPOVER_CONTENT);
    await this.driver.executeScript(
      "var element = document.getElementById('popover-content'); if(element) element.remove();",
    );
  }

  async acceptTNC() {
    const XPATH_CHECKBOX_TERMS_POPOVER = buildDataTestIdXpath(
      CHECKBOX_TERMS_POPOVER,
    );
    await scrollIntoView(this.driver, XPATH_CHECKBOX_TERMS_POPOVER);
    await clickElement(this.driver, XPATH_CHECKBOX_TERMS_POPOVER);
    const XPATH_BTN_TERMS_POPOVER_ACCEPT = buildDataTestIdXpath(
      BTN_TERMS_POPOVER_ACCEPT,
    );
    await clickElement(this.driver, XPATH_BTN_TERMS_POPOVER_ACCEPT);
  }

  async acceptModal(driver: WebDriver) {
    const XPATH_BTN_CONNECT_ACCOUNT = buildDataTestIdXpath(BTN_CONNECT_ACCOUNT);
    await waitForElement(driver, XPATH_BTN_CONNECT_ACCOUNT);
    await clickElement(driver, XPATH_BTN_CONNECT_ACCOUNT);
    await clickElement(driver, XPATH_BTN_CONNECT_ACCOUNT);
  }

  private static async acceptNetwork(driver: WebDriver) {
    const XPATH_BTN_CONFIRM = buildDataTestIdXpath(BTN_GENERIC_CONFIRMATION);
    await clickElement(driver, XPATH_BTN_CONFIRM);
    await clickElement(driver, XPATH_BTN_CONFIRM);
  }

  private static async acceptContract(driver: WebDriver) {
    const XPATH_BTN_APPROVE_CONTRACT = buildDataTestIdXpath(BTN_FOOTER_NEXT);
    await waitForElement(driver, XPATH_BTN_APPROVE_CONTRACT);
    await clickElement(driver, XPATH_BTN_APPROVE_CONTRACT);
    const XPATH_SPENDING_CAP_VALUE = buildClassXpath(
      "mm-box review-spending-cap__value",
    );
    await waitForElementVisible(driver, XPATH_SPENDING_CAP_VALUE);
    await clickElement(driver, XPATH_BTN_APPROVE_CONTRACT);
  }

  private static async signTransaction(driver: WebDriver) {
    const XPATH_SCROLL_DOWN = "//*[@aria-label='Scroll down']";
    await waitForElement(driver, XPATH_SCROLL_DOWN);
    await clickElement(driver, XPATH_SCROLL_DOWN);
    const XPATH_BTN_SIGN_TRANSACTION = buildDataTestIdXpath(
      BTN_CONFIRM_TRANSACTION,
    );
    await waitForElement(driver, XPATH_BTN_SIGN_TRANSACTION);
    await waitForElementEnabled(driver, XPATH_BTN_SIGN_TRANSACTION);
    await clickElement(driver, XPATH_BTN_SIGN_TRANSACTION);
  }

  private static async rejectTransaction(driver: WebDriver) {
    const XPATH_SCROLL_DOWN = "//*[@aria-label='Scroll down']";
    await waitForElement(driver, XPATH_SCROLL_DOWN);
    await clickElement(driver, XPATH_SCROLL_DOWN);
    const XPATH_BTN_REJECT_TRANSACTION = buildDataTestIdXpath(
      BTN_REJECT_TRANSACTION,
    );
    const XPATH_CANCEL_BTN = await buildXpathByElementText("button", "Cancel");
    //handle different cancel flows
    try {
      await waitForElement(driver, XPATH_CANCEL_BTN, 10000);
      await clickElement(driver, XPATH_CANCEL_BTN);
    } catch (e) {
      await waitForElement(driver, XPATH_BTN_REJECT_TRANSACTION, 10000);
      await clickElement(driver, XPATH_BTN_REJECT_TRANSACTION);
    }
  }

  private static async rejectDeposit(driver: WebDriver) {
    const XPATH_BTN_REJECT_TRANSACTION = buildDataTestIdXpath(
      BTN_REJECT_TRANSACTION,
    );
    await waitForElement(driver, XPATH_BTN_REJECT_TRANSACTION, 10000);
    await clickElement(driver, XPATH_BTN_REJECT_TRANSACTION);
  }

  async closeAnyExtraWindow(driver: WebDriver) {
    const XPATH_CLOSE = "//*[@aria-label='Close']";
    await clickElement(driver, XPATH_CLOSE);
  }

  private static async signDeposit(driver: WebDriver) {
    const XPATH_BTN_SIGN_TRANSACTION = buildDataTestIdXpath(BTN_FOOTER_NEXT);
    await waitForElement(driver, XPATH_BTN_SIGN_TRANSACTION);
    await waitForElementEnabled(driver, XPATH_BTN_SIGN_TRANSACTION);
    await clickElement(driver, XPATH_BTN_SIGN_TRANSACTION);
  }
  private static async signWithdrawal(driver: WebDriver) {
    const XPATH_SCROLL_DOWN = "//*[@aria-label='Scroll down']";
    await waitForElement(driver, XPATH_SCROLL_DOWN);
    await clickElement(driver, XPATH_SCROLL_DOWN);
    const XPATH_BTN_SIGN_TRANSACTION = buildDataTestIdXpath(
      BTN_CONFIRM_TRANSACTION,
    );
    await waitForElement(driver, XPATH_BTN_SIGN_TRANSACTION);
    await waitForElementEnabled(driver, XPATH_BTN_SIGN_TRANSACTION);
    await clickElement(driver, XPATH_BTN_SIGN_TRANSACTION);
  }

  async acceptPermissions() {
    await doActionInDifferentWindow(this.driver, this.acceptModal);
  }

  static async acceptNetworkSwitch(driver: WebDriver) {
    await doActionInDifferentWindow(driver, this.acceptNetwork);
    return;
  }
  //handle sign and contract , rename below too
  static async acceptContractInDifferentWindow(driver: WebDriver) {
    await doActionInDifferentWindow(driver, this.acceptContract);
  }

  static async signTransactionInDifferentWindow(driver: WebDriver) {
    await doActionInDifferentWindow(driver, this.signTransaction);
  }

  static async rejectTransactionInDifferentWindow(driver: WebDriver) {
    await doActionInDifferentWindow(driver, this.rejectTransaction);
  }

  static async rejectDepositInDifferentWindow(driver: WebDriver) {
    await doActionInDifferentWindow(driver, this.rejectDeposit);
  }

  static async signDepositInDifferentWindow(driver: WebDriver) {
    await doActionInDifferentWindow(driver, this.signDeposit);
  }

  static async signWithdrawInDifferentWindow(driver: WebDriver) {
    await doActionInDifferentWindow(driver, this.signWithdrawal);
  }
}
