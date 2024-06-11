import { Chain, defineChain } from "viem";

interface TestChain extends Chain {
  contracts: {
    rollDown: {
      address: `0x{string}`;
    };
    dummyErc20: {
      address: `0x{string}`;
    };
  };
  gaspName: string;
}
export const EthAnvil: TestChain = defineChain({
  id: 31_337,
  name: "EthAnvil",
  nativeCurrency: {
    decimals: 18,
    name: "Ethereum",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8545"],
      webSocket: ["ws://127.0.0.1:8545"],
    },
  },
  contracts: {
    rollDown: {
      address: "0x2bdCC0de6bE1f7D2ee689a0342D76F52E8EFABa3",
    },
    dummyErc20: {
      address: "0xCD8a1C3ba11CF5ECfa6267617243239504a98d90",
    },
  },
  gaspName: "Ethereum",
}) as any as TestChain;
export const ArbAnvil: TestChain = defineChain({
  id: 31_337,
  name: "ArbAnvil",
  nativeCurrency: {
    decimals: 18,
    name: "Ethereum",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8546"],
      webSocket: ["ws://127.0.0.1:8546"],
    },
  },
  contracts: {
    rollDown: {
      address: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
    },
    dummyErc20: {
      address: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
    },
  },
  gaspName: "Arbitrum",
}) as any as TestChain;

export type L1Type = "EthAnvil" | "ArbAnvil";

export function getL1(type: L1Type) {
  switch (type) {
    case "EthAnvil":
      return EthAnvil;
    case "ArbAnvil":
      return ArbAnvil;
    default:
      return undefined;
  }
}
