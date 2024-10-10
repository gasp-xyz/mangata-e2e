import { WebDriver } from "selenium-webdriver";
import { ApiContext } from "../../Framework/XcmHelper";
import { Polkadot } from "../pages/Polkadot";
import {
  acceptNetworkSwitchInNewWindow,
  acceptPermissionsWalletExtensionInNewWindow,
} from "../utils/Helper";
import { BN_TEN } from "@mangata-finance/sdk";
import { BN } from "@polkadot/util";
import { Main } from "../rollup-pages/Main";
import { WalletWrapper } from "../rollup-pages/WalletWrapper";
import { MetaMask } from "../pages/MetaMask";
import {
  TransactionType,
  NotificationToast,
  ToastType,
} from "../rollup-pages/NotificationToast";
import { DepositModal } from "./DepositModal";
import { WithdrawModal } from "../rollup-pages/WithdrawModal";
import { WalletConnectModal } from "../rollup-pages/WalletConnectModal";

export async function connectWallet(
  driver: WebDriver,
  walletType: string,
  acc_addr: string,
  prod = false,
) {
  const walletWrapper = new WalletWrapper(driver);
  const isWalletStatus = await walletWrapper.isWalletStatusDisplayed();
  expect(isWalletStatus).toBeTruthy();

  await walletWrapper.openWalletConnectionInfo();
  let isWalletConnected = await walletWrapper.isWalletDetailsConnected();
  expect(isWalletConnected).toBeFalsy();

  await walletWrapper.clickWalletConnect();
  await walletWrapper.pickWallet(walletType);

  const walletConnectModal = new WalletConnectModal(driver);
  let isWalletConnectModalDisplayed = await walletConnectModal.displayed();
  expect(isWalletConnectModalDisplayed).toBeTruthy();

  await acceptPermissionsWalletExtensionInNewWindow(driver, walletType);
  if (prod) {
    await acceptNetworkSwitchInNewWindow(driver);
  }

  await walletConnectModal.waitForaccountsDisplayed();
  const areAccountsDisplayed = await walletConnectModal.accountsDisplayed();
  expect(areAccountsDisplayed).toBeTruthy();

  await walletConnectModal.pickAccount(acc_addr);
  isWalletConnectModalDisplayed = await walletConnectModal.displayed();
  expect(isWalletConnectModalDisplayed).toBeFalsy();

  isWalletConnected = await walletWrapper.isWalletDetailsConnected();
  expect(isWalletConnected).toBeTruthy();
}

export async function setupPage(driver: WebDriver) {
  const mainPage = new Main(driver);
  await mainPage.go();
  const appLoaded = await mainPage.isAppLoaded();
  expect(appLoaded).toBeTruthy();
  await mainPage.skipWelcomeMessage();
  await mainPage.skipMailerIframe();
  await mainPage.skipLaunchMessage();
}

export async function setupPageWithState(driver: WebDriver, acc_name: string) {
  const mainPage = new Main(driver);
  await mainPage.go();
  const appLoaded = await mainPage.isAppLoaded();
  expect(appLoaded).toBeTruthy();
  await mainPage.skipLaunchMessage();

  const walletWrapper = new WalletWrapper(driver);
  const isAccInfoDisplayed = await walletWrapper.isAccInfoDisplayed(acc_name);
  expect(isAccInfoDisplayed).toBeTruthy();
}

export async function waitForMicroappsActionNotification(
  driver: WebDriver,
  chainOne: ApiContext,
  chainTwo: ApiContext,
  transaction: TransactionType,
  numOfBLocks = 1,
) {
  const toast = new NotificationToast(driver);
  await toast.waitForToastState(ToastType.Confirm, transaction, 3000);
  const isModalWaitingForSignVisible = await toast.istoastVisible(
    ToastType.Confirm,
    transaction,
  );
  expect(isModalWaitingForSignVisible).toBeTruthy();
  await Polkadot.signTransaction(driver);
  const promises = [];
  await chainOne.chain.newBlock();
  await chainTwo.chain.newBlock();
  let i = 1;
  do {
    const INTERVAL = 2000;
    promises.push(delayedNewBlock(chainOne, i * INTERVAL));
    promises.push(delayedNewBlock(chainTwo, i * INTERVAL + 1000));
    i++;
  } while (i < numOfBLocks);
  promises.push(toast.waitForToastState(ToastType.Success, transaction));
  await Promise.all(promises);
}

export async function waitForActionNotification(
  driver: WebDriver,
  transaction: TransactionType,
  rejection = false,
) {
  switch (transaction) {
    case TransactionType.ApproveContract:
      await MetaMask.acceptContractInDifferentWindow(driver);
      break;
    case TransactionType.Deposit:
      const depositModal = new DepositModal(driver);
      await depositModal.waitForConfirmingVisible();
      if (rejection) {
        await MetaMask.rejectDepositInDifferentWindow(driver);
        await depositModal.waitForErrVisible();
      } else {
        await MetaMask.signDepositInDifferentWindow(driver);
        await depositModal.waitForSuccessVisible();
      }
      break;
    case TransactionType.Withdraw:
      const withdrawModal = new WithdrawModal(driver);
      await withdrawModal.waitForConfirmingVisible();
      if (rejection) {
        await MetaMask.rejectTransactionInDifferentWindow(driver);
        await withdrawModal.waitForErrVisible();
      } else {
        await MetaMask.signWithdrawInDifferentWindow(driver);
        await withdrawModal.waitForSuccessVisible();
      }
      break;
    case TransactionType.AddLiquidity:
    case TransactionType.RemoveLiquidity:
    case TransactionType.CreatePool:
      const removeLiqToast = new NotificationToast(driver);
      await removeLiqToast.waitForToastState(
        ToastType.Confirm,
        transaction,
        5000,
      );
      const isWaitingForSignVisible = await removeLiqToast.istoastVisible(
        ToastType.Confirm,
        transaction,
      );
      expect(isWaitingForSignVisible).toBeTruthy();
      if (rejection) {
        await MetaMask.rejectTransactionInDifferentWindow(driver);
        await removeLiqToast.waitForToastState(ToastType.Error, transaction);
      } else {
        await MetaMask.signTransactionInDifferentWindow(driver);
        await removeLiqToast.waitForToastState(ToastType.Success, transaction);
      }
      break;
    case TransactionType.Swap:
      const swapToast = new NotificationToast(driver);
      await swapToast.waitForToastState(ToastType.Confirm, transaction, 3000);
      const isToastWaitingForSignVisible = await swapToast.istoastVisible(
        ToastType.Confirm,
        transaction,
      );
      expect(isToastWaitingForSignVisible).toBeTruthy();
      if (rejection) {
        await MetaMask.rejectTransactionInDifferentWindow(driver);
        await swapToast.waitForToastState(ToastType.Error, transaction);
      } else {
        await MetaMask.signTransactionInDifferentWindow(driver);
        await swapToast.waitForToastState(ToastType.Success, transaction);
      }
      break;
    default:
      const toast = new NotificationToast(driver);
      await toast.waitForToastState(ToastType.Confirm, transaction, 3000);
      const isModalWaitingForSignVisible = await toast.istoastVisible(
        ToastType.Confirm,
        transaction,
      );
      expect(isModalWaitingForSignVisible).toBeTruthy();
      await MetaMask.signTransactionInDifferentWindow(driver);
      await toast.waitForToastState(ToastType.Success, transaction);
  }
}

async function delayedNewBlock(chainName: ApiContext, delayMs: number) {
  await delay(delayMs);
  return chainName.chain.newBlock();
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function addLiqTokenMicroapps(
  userAddress: string,
  apiContext: ApiContext,
  tokenId: number,
  power: number,
  value: number,
) {
  await apiContext.dev.setStorage({
    Tokens: {
      Accounts: [
        [
          [userAddress, { token: tokenId }],
          { free: BN_TEN.pow(new BN(power)).mul(new BN(value)).toString() },
        ],
      ],
    },
  });
}
