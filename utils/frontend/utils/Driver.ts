import { WebDriver, Capabilities, logging } from "selenium-webdriver";

import "chromedriver";
import { Builder } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome";
const path = "utils/frontend/utils/extensions";
const metamaskExtensionPath = `${path}/meatamask_12.3.1.crx`;

// Singleton constructor
export const DriverBuilder = (function () {
  async function buildChromeDriver(addExtensions = true, debugLogs = false) {
    const options = new chrome.Options();
    if (addExtensions) {
      options.addExtensions(metamaskExtensionPath);
    }
    options
      .addArguments("--disable-dev-shm-usage")
      .addArguments("--enable-clipboard-read")
      .addArguments("--disable-search-engine-choice-screen");
    //.addArguments("--disable-web-security");
    const prefs = new logging.Preferences();
    prefs.setLevel(logging.Type.BROWSER, logging.Level.DEBUG);
    prefs.setLevel(logging.Type.CLIENT, logging.Level.DEBUG);
    prefs.setLevel(logging.Type.DRIVER, logging.Level.DEBUG);
    prefs.setLevel(logging.Type.PERFORMANCE, logging.Level.DEBUG);
    prefs.setLevel(logging.Type.SERVER, logging.Level.DEBUG);

    let caps: Capabilities = new Capabilities();
    caps = Capabilities.chrome();
    caps.set("version", "128.0");
    caps.set("selenoid:options", {
      enableVNC: true,
      enableVideo: true,
      enableLog: true,
    });
    if (debugLogs) {
      caps.set("goog:loggingPrefs", prefs);
    }

    driver = new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .withCapabilities(caps)
      .build();
    await driver!.manage().setTimeouts({ script: 5000 });
    await driver!.manage().window().maximize();
    if (addExtensions) {
      await waitForMultipleTabs(driver);
    }

    return driver;
  }

  async function waitForMultipleTabs(driver: WebDriver) {
    await driver.wait(
      async () => {
        const handles = await driver.getAllWindowHandles();
        return handles.length > 1;
      },
      10000,
      "Waiting for all extensions tabs to open",
    );
  }

  let driver: WebDriver | undefined;
  return {
    getInstance: async function (
      withExtensions = true,
      debugLogs = false,
    ): Promise<WebDriver> {
      if (!driver) {
        driver = await buildChromeDriver(withExtensions, debugLogs);
      }
      return driver!;
    },
    destroy: async function () {
      driver = undefined;
    },
  };
})();
