import {api, getApi, initApi} from "../../utils/api";
import { sellAsset, buyAsset, calculate_buy_price_rpc} from '../../utils/tx'
import {waitNewBlock, ExtrinsicResult} from '../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../utils/User";
import { validateTreasuryAmountsEqual } from "../../utils/validators";
import { Assets } from "../../utils/Assets";
import { calculateFees, getEnvironmentRequiredVars } from "../../utils/utils";
import { getEventResultFromTxWait, signSendAndWaitToFinishTx } from "../../utils/txHandler";


jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

var first_asset_amount = new BN(50000);
const defaultCurrecyValue = new BN(250000);
const {sudo:sudoUserName} = getEnvironmentRequiredVars();


describe('xyk-pallet - treasury tests [No Mangata]: on treasury we store', () => {
	
	var testUser1 : User;
	var sudo : User;

	var keyring : Keyring;
	var firstCurrency :BN;
	var secondCurrency :BN;

	//creating pool
	
	beforeAll( async () => {
		try {
			getApi();
		  } catch(e) {
			await initApi();
		}
	});

	beforeEach(async () => {
		await waitNewBlock();
		keyring = new Keyring({ type: 'sr25519' });
	
		// setup users
		testUser1 = new User(keyring);
	
		sudo = new User(keyring, sudoUserName);
		
		// add users to pair.
		keyring.addPair(testUser1.keyRingPair);
		keyring.addPair(sudo.keyRingPair);

		await waitNewBlock();
		[firstCurrency, secondCurrency] = await Assets.setupUserWithCurrencies(testUser1, [defaultCurrecyValue,defaultCurrecyValue], sudo);
		await testUser1.addMGATokens(sudo);
		await signSendAndWaitToFinishTx( 
			api?.tx.xyk.createPool(firstCurrency, first_asset_amount, secondCurrency, first_asset_amount.div(new BN(2))), 
			testUser1.keyRingPair 
		);
		await testUser1.refreshAmounts(AssetWallet.BEFORE);

	});

	test('assets won when assets are sold - 5 [no connected to MGA]', async () => {

		await waitNewBlock();
		let sellAssetAmount = new BN(10000);

		await sellAsset(testUser1.keyRingPair, secondCurrency, firstCurrency, sellAssetAmount, new BN(1))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result, ["xyk", "AssetsSwapped", '14', testUser1.keyRingPair.address]);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			}
		);
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);

		const { treasury, treasuryBurn }= calculateFees(sellAssetAmount)
		
		await validateTreasuryAmountsEqual(firstCurrency,[new BN(0),new BN(0)]);
		await validateTreasuryAmountsEqual(secondCurrency,[treasury,treasuryBurn]);
		
	});
	test('assets won when assets are sold - 1 [rounding] [no connected to MGA]', async () => {

		await waitNewBlock();
		let sellAssetAmount = new BN(500);

		await sellAsset(testUser1.keyRingPair, firstCurrency, secondCurrency, sellAssetAmount, new BN(1))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result, ["xyk", "AssetsSwapped", '14', testUser1.keyRingPair.address]);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			}
		);
		
		await testUser1.refreshAmounts(AssetWallet.AFTER);
		const { treasury, treasuryBurn }= calculateFees(sellAssetAmount)
		await validateTreasuryAmountsEqual(firstCurrency,[treasury,treasuryBurn]);
		await validateTreasuryAmountsEqual(secondCurrency,[new BN(0), new BN(0)]);
		
	});

	test('assets won when assets are bought - 2 [no connected to MGA]', async () => {

		await waitNewBlock();
		let buyAssetAmount = new BN(10000);
		let sellPriceRpc = await calculate_buy_price_rpc(first_asset_amount, first_asset_amount.div(new BN(2)), buyAssetAmount);
		await buyAsset(testUser1.keyRingPair, firstCurrency, secondCurrency, buyAssetAmount, new BN(100000000))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result, ["xyk", "AssetsSwapped", '14', testUser1.keyRingPair.address]);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			}
		);

		await testUser1.refreshAmounts(AssetWallet.AFTER);
		const { treasury, treasuryBurn } = calculateFees(sellPriceRpc)
		await validateTreasuryAmountsEqual(secondCurrency,[new BN(0),new BN(0)]);
		//treasuries are stored always in the sold asset
		await validateTreasuryAmountsEqual(firstCurrency,[treasury,treasuryBurn]);
		
	});

	test('assets won when assets are bought - 1 [no connected to MGA]', async () => {

		await waitNewBlock();
		let buyAssetAmount = new BN(100);
		let sellPriceRpc = await calculate_buy_price_rpc(first_asset_amount, first_asset_amount.div(new BN(2)), buyAssetAmount);
		await buyAsset(testUser1.keyRingPair, firstCurrency, secondCurrency, buyAssetAmount, new BN(100000000))
		.then(
			(result) => {
				const eventResponse = getEventResultFromTxWait(result, ["xyk", "AssetsSwapped", '14', testUser1.keyRingPair.address]);
				expect(eventResponse.state).toEqual(ExtrinsicResult.ExtrinsicSuccess);
			}
		);

		await testUser1.refreshAmounts(AssetWallet.AFTER);
		const { treasury, treasuryBurn }= calculateFees(sellPriceRpc)
		await validateTreasuryAmountsEqual(firstCurrency,[treasury,treasuryBurn]);
		await validateTreasuryAmountsEqual(secondCurrency,[new BN(0), new BN(0)]);
		
	});


});