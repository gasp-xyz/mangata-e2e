import { BN } from "@polkadot/util";
import { v4 as uuid } from "uuid";
import { ExtrinsicResult, waitNewBlock } from "./eventListeners";
import { testLog } from "./Logger";
import {
  buyAsset,
  createPool,
  delegate,
  FeeTxs,
  getAllAssets,
  getTokensAccountInfo,
  getUserAssets,
  joinCandidate,
  mintAsset,
  mintLiquidity,
  mintLiquidityUsingVestingNativeTokens,
  registerAsset,
  reserveVestingLiquidityTokens,
  transferAll,
  updateAsset,
} from "./tx";
import { getEventResultFromMangataTx } from "./txHandler";
import {
  KSM_ASSET_ID,
  MAX_BALANCE,
  MGA_ASSET_ID,
  TUR_ASSET_ID,
} from "./Constants";
import { strict as assert } from "assert";
import { toBN, TokenBalance } from "@mangata-finance/sdk";
import { KeyringPair } from "@polkadot/keyring/types";
import Keyring from "@polkadot/keyring";
import { EthUser } from "./EthUser";

export enum AssetWallet {
  BEFORE,
  AFTER,
}

export class User {
  /**
   * class that represent the user and wallet.
   */
  keyRingPair: KeyringPair;
  name: String;
  keyring: Keyring;
  assets: Asset[];

  constructor(keyring: Keyring, name = "", json: any = undefined) {
    let autoGenerated = false;
    if (!name) {
      name = "//testUser_" + uuid();
      autoGenerated = true;
    }
    this.name = name;
    this.keyring = keyring;
    if (json) {
      this.keyRingPair = keyring.createFromJson(json);
    } else {
      this.keyRingPair = keyring.createFromUri(name);
    }
    this.assets = [];
    if (autoGenerated) {
      testLog
        .getLog()
        .info(`name: ${this.name}, address: ${this.keyRingPair.address}`);
    }
  }
  toString() {
    return this.keyRingPair.address;
  }
  addFromMnemonic(keyring: Keyring, mnemonic: string) {
    this.keyRingPair = keyring.addFromMnemonic(mnemonic);
    this.name = "mnemonic_created_account";
  }

  addFromAddress(keyring: Keyring, address: string) {
    this.keyRingPair = keyring.addFromAddress(address);
    this.name = "addres_created_account";
  }

  addAsset(currecncyId: any, amountBefore = new BN(0)) {
    const assetData = {
      free: amountBefore,
    };
    const amountBeforeAsAccData = assetData as TokenBalance;
    const asset = new Asset(currecncyId, amountBeforeAsAccData);

    if (
      this.assets.find((asset) => asset.currencyId === currecncyId) ===
      undefined
    ) {
      this.assets.push(asset);
    }
  }
  addAssets(currencyIds: any[]) {
    currencyIds.forEach((element) => {
      this.addAsset(element);
    });
  }
  getAsset(currecncyId: any, onlyFreeValues = true) {
    if (onlyFreeValues) {
      return this.getFreeAssetAmount(currecncyId);
    }
    return this.assets.find((asset) => asset.currencyId === currecncyId);
  }
  getFreeAssetAmount(currecncyId: any) {
    const wallet = this.assets.find(
      (asset) => asset.currencyId === currecncyId,
    );
    return new Asset(currecncyId, wallet!.amountBefore, wallet!.amountAfter);
  }
  getFreeAssetAmounts() {
    return this.assets.map((asset) =>
      this.getFreeAssetAmount(asset.currencyId),
    );
  }
  async refreshAmounts(beforeOrAfter: AssetWallet = AssetWallet.BEFORE) {
    const currencies = this.assets.map((asset) => new BN(asset.currencyId));
    const assetValues = await getUserAssets(
      this.keyRingPair.address,
      currencies,
    );

    for (let index = 0; index < this.assets.length; index++) {
      if (beforeOrAfter === AssetWallet.BEFORE) {
        this.assets[index].amountBefore = assetValues[index];
      } else {
        this.assets[index].amountAfter = assetValues[index];
      }
    }
  }
  getWalletDifferences(): AssetsDiff[] {
    const tokensThatChanged = this.getFreeAssetAmounts().filter(
      (x) =>
        !x.amountBefore.free.eq(x.amountAfter.free) ||
        !x.amountBefore.reserved.eq(x.amountAfter.reserved) ||
        !x.amountBefore.frozen.eq(x.amountAfter.frozen),
    );

    return tokensThatChanged.map((value) => {
      return new AssetsDiff(value.currencyId, {
        free: value.amountAfter.free.sub(value.amountBefore.free),
        reserved: value.amountAfter.reserved.sub(value.amountBefore.reserved),
        frozen: value.amountAfter.frozen.sub(value.amountBefore.frozen),
      });
    });
  }
  async buyAssets(
    soldAssetId: BN,
    boughtAssetId: BN,
    amount: BN,
    maxExpected = new BN(1000000),
  ) {
    return await buyAsset(
      this.keyRingPair,
      soldAssetId,
      boughtAssetId,
      amount,
      maxExpected,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "AssetsSwapped",
        this.keyRingPair.address,
      ]);
      assert.equal(eventResponse.state, ExtrinsicResult.ExtrinsicSuccess);
      return result;
    });
  }

  async mint(assetId: BN, user: User, amount: BN) {
    await mintAsset(this.keyRingPair, assetId, user, amount).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "tokens",
        "Minted",
        (user as EthUser).ethAddress.toLowerCase(),
      ]);
      assert.equal(eventResponse.state, ExtrinsicResult.ExtrinsicSuccess);
    });
  }

  async sellAssets(soldAssetId: BN, boughtAssetId: BN, amount: BN) {
    return await new FeeTxs()
      .sellAsset(
        this.keyRingPair,
        soldAssetId,
        boughtAssetId,
        amount,
        new BN(0),
      )
      .then((result) => {
        const eventResponse = getEventResultFromMangataTx(result, [
          "xyk",
          "AssetsSwapped",
          this.keyRingPair.address,
        ]);
        assert.equal(eventResponse.state, ExtrinsicResult.ExtrinsicSuccess);
        return result;
      });
  }
  async mintLiquidity(
    firstCurrency: BN,
    secondCurrency: BN,
    firstCurrencyAmount: BN,
    secondCurrencyAmount: BN = new BN(MAX_BALANCE),
  ) {
    await mintLiquidity(
      this.keyRingPair,
      firstCurrency,
      secondCurrency,
      firstCurrencyAmount,
      secondCurrencyAmount,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "LiquidityMinted",
        this.keyRingPair.address,
      ]);
      assert.equal(eventResponse.state, ExtrinsicResult.ExtrinsicSuccess);
    });
  }

  async mintLiquidityWithVestedTokens(
    vestingTokensAmount: BN,
    secondAssetId: BN,
    expectedSecondAssetAmount: BN = new BN(Number.MAX_SAFE_INTEGER),
  ) {
    await mintLiquidityUsingVestingNativeTokens(
      this.keyRingPair,
      vestingTokensAmount,
      secondAssetId,
      expectedSecondAssetAmount,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "LiquidityMinted",
        this.keyRingPair.address,
      ]);
      assert.equal(eventResponse.state, ExtrinsicResult.ExtrinsicSuccess);
    });
  }
  async joinAsCandidate(
    liqTokenForCandidate: BN,
    amount: BN,
    from = "availablebalance",
  ) {
    await joinCandidate(this.keyRingPair, liqTokenForCandidate, amount, from);
  }
  async joinAsDelegator(liqTokenForCandidate: BN, amount: BN) {
    await delegate(
      this.keyRingPair,
      liqTokenForCandidate,
      amount,
      "AvailableBalance",
    );
  }

  async reserveVestingLiquidityTokens(
    liqToken: BN,
    amount: BN,
    strictSuccess = true,
  ) {
    return await reserveVestingLiquidityTokens(
      this.keyRingPair,
      liqToken,
      amount,
      strictSuccess,
    );
  }

  async removeTokens() {
    //TODO: find a proper way to clean all the user tokens in one shot!
    const assets = await getAllAssets(this.keyRingPair.address);
    for (let index = 0; index < assets.length; index++) {
      const assetId = assets[index];
      await transferAll(
        this.keyRingPair,
        assetId,
        process.env.E2E_XYK_PALLET_ADDRESS,
      );
    }
  }
  async createPoolToAsset(
    first_asset_amount: BN,
    second_asset_amount: BN,
    firstCurrency: BN,
    secondCurrency: BN,
  ) {
    await createPool(
      this.keyRingPair,
      firstCurrency,
      first_asset_amount,
      secondCurrency,
      second_asset_amount,
    ).then((result) => {
      const eventResponse = getEventResultFromMangataTx(result, [
        "xyk",
        "PoolCreated",
        this.keyRingPair.address,
      ]);
      assert.equal(eventResponse.state, ExtrinsicResult.ExtrinsicSuccess);
    });
  }

  async addMGATokens(
    sudo: User,
    amountFree: BN = new BN(BigInt(1000 * 10 ** 20).toString()),
  ) {
    await sudo.mint(MGA_ASSET_ID, this, amountFree);
  }

  async addKSMTokens(sudo: User, amountFree: BN = toBN("1", 13)) {
    await sudo.mint(KSM_ASSET_ID, this, amountFree);
  }

  async addTURTokens(sudo: User, amountFree: BN = toBN("1", 11)) {
    await sudo.mint(TUR_ASSET_ID, this, amountFree);
  }

  async getUserTokensAccountInfo(tokenId = new BN(0)) {
    return await getTokensAccountInfo(this.keyRingPair.address, tokenId);
  }
  static async waitUntilBNChanged(
    amountBefore: BN,
    fn: () => Promise<BN>,
  ): Promise<void> {
    let amount: BN;
    do {
      await waitNewBlock();
      amount = await fn();
    } while (amount.eq(amountBefore));
  }

  async registerAsset(
    assetId: BN,
    locMarker = assetId,
    location = {
      V2: {
        parents: 1,
        interior: {
          X3: [
            {
              Parachain: 3210 + assetId.toNumber(),
            },
            {
              GeneralKey: "0x00834",
            },
            {
              PalletInstance: 10,
            },
          ],
        },
      },
    },
  ) {
    return await registerAsset(this, assetId, location, locMarker, null);
  }

  async updateAsset(
    assetId: any,
    additional = {
      xcm: {
        feePerSecond: 53760000000001,
      },
    },
    location = {
      V2: {
        parents: 1,
        interior: {
          X3: [
            {
              Parachain: 3210 + assetId.toNumber(),
            },
            {
              GeneralKey: "0x00834",
            },
            {
              PalletInstance: 10,
            },
          ],
        },
      },
    },
  ) {
    return await updateAsset(this, assetId, location, additional);
  }
}
export class Asset {
  amountBefore: TokenBalance;
  amountAfter: TokenBalance;
  currencyId: BN;

  constructor(
    currencyId: BN,
    amountBefore = { free: new BN(0) } as TokenBalance,
    amountAfter = { free: new BN(0) } as TokenBalance,
  ) {
    this.currencyId = currencyId;
    this.amountBefore = amountBefore;
    this.amountAfter = amountAfter;
  }
}

export class AssetsDiff {
  currencyId: BN;
  diff: TokenBalance;

  /**
   *
   */
  constructor(currencyId: BN, diff: TokenBalance) {
    this.currencyId = currencyId;
    this.diff = diff;
  }
}
