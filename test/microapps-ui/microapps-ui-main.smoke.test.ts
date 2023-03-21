/*
 *
 * @group microappsUI
 */
import { WebDriver } from "selenium-webdriver";
import { getApi, initApi } from "../../utils/api";
import { Mangata } from "../../utils/frontend/pages/Mangata";
import { DriverBuilder } from "../../utils/frontend/utils/Driver";
import { addExtraLogs } from "../../utils/frontend/utils/Helper";

import { FIVE_MIN } from "../../utils/Constants";
import { Main } from "../../utils/frontend/microapps-pages/Main";

jest.setTimeout(FIVE_MIN);
jest.spyOn(console, "log").mockImplementation(jest.fn());
let driver: WebDriver;

describe("Miocroapps UI smoke tests", () => {
  beforeEach(async () => {
    try {
      getApi();
    } catch (e) {
      await initApi();
    }
  });

  it("App is starting", async () => {
    driver = await DriverBuilder.getInstance(false);

    const mga = new Mangata(driver);
    await mga.go();
    const mainPage = new Main(driver);
    const appLoaded = await mainPage.isAppDisplayed();
    expect(appLoaded).toBeTruthy();
  });

  afterEach(async () => {
    const session = await driver.getSession();
    await addExtraLogs(
      driver,
      expect.getState().currentTestName + " - " + session.getId()
    );
    await driver.quit();
    DriverBuilder.destroy();
  });

  afterAll(async () => {
    const api = getApi();
    await api.disconnect();
  });
});
