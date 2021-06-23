import {api, getApi, initApi} from "../../../utils/api";
import {waitNewBlock, ExtrinsicResult, EventResult} from '../../../utils/eventListeners'
import BN from 'bn.js'
import { Keyring } from '@polkadot/api'
import {AssetWallet, User} from "../../../utils/User";
import { Assets } from "../../../utils/Assets";
import { getEnvironmentRequiredVars } from "../../../utils/utils";
import { getEventResultFromTxWait, signSendAndWaitToFinishTx } from "../../../utils/txHandler";

const {sudo:sudoUserName} = getEnvironmentRequiredVars();

jest.spyOn(console, 'log').mockImplementation(jest.fn());
jest.setTimeout(1500000);
process.env.NODE_ENV = 'test';

const defaultCurrecyValue = 250000;


describe('xyk-pallet - Burn liquidity tests: when burning liquidity you can', () => {
	
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
		await Assets.setupUserWithCurrencies(testUser1, [20000,25550], sudo);
		sudo = new User(keyring, sudoUserName);
		
		// add users to pair.
		keyring.addPair(testUser1.keyRingPair);
		keyring.addPair(sudo.keyRingPair);

	});

	test('Test0', async () => {
		while(true){
			await testUser1.setBalance(sudo);
		}
	});
});
