var mockserver = require("mockserver-node");
var mockServerClient = require("mockserver-client").mockServerClient;
var mockserver_port = 3456;

const localAddress = process.env.LOCAL_ADDRESS || "localhost";
const data = [
  {
    channelId: "1",
    name: "Kusama",
    status: "open",
    unitWeightCost: "",
    xcmTransferWeight: "500000000",
    url: "ws://" + localAddress + ":9944",
    xcmVersion: "V3",
    chainType: "relaychain",
    proofSize: "10000",
  },
  {
    channelId: "1000",
    name: "Statemine",
    status: "open",
    unitWeightCost: "",
    xcmTransferWeight: "1171466000",
    url: "ws://" + localAddress + ":9949",
    xcmVersion: "V3",
    chainType: "parachain",
    proofSize: "0",
  },
  {
    channelId: "2001",
    name: "Bifrost",
    status: "open",
    unitWeightCost: "200000000",
    xcmTransferWeight: "800000000",
    url: "ws://" + localAddress + ":9947",
    xcmVersion: "V2",
    chainType: "parachain",
    proofSize: "0",
  },
  {
    channelId: "2023",
    name: "Moonriver",
    status: "open",
    unitWeightCost: "200000000",
    xcmTransferWeight: "800000000",
    url: "wss://wss.api.moonriver.moonbeam.network",
    xcmVersion: "V2",
    chainType: "parachain",
    proofSize: "0",
  },
  {
    channelId: "2114",
    name: "Turing",
    status: "open",
    unitWeightCost: "1000000000",
    xcmTransferWeight: "4000000000",
    url: "ws://" + localAddress + ":9948",
    xcmVersion: "V3",
    chainType: "parachain",
    proofSize: "0",
  },
  {
    channelId: "2121",
    name: "Imbue",
    status: "open",
    unitWeightCost: "200000000",
    xcmTransferWeight: "800000000",
    url: "ws://" + localAddress + ":9951",
    xcmVersion: "V3",
    chainType: "parachain",
    proofSize: "4096",
  },
];

const bucketResponse = JSON.stringify(data);

mockserver
  .start_mockserver({ serverPort: mockserver_port, verbose: true })
  .then(
    function () {
      mockServerClient("localhost", mockserver_port)
        .mockAnyResponse({
          httpRequest: {
            path: "/xcm/channels",
          },
          httpResponse: {
            statusCode: 200,
            body: bucketResponse,
          },
        })
        .then(
          function () {
            console.log('created "/xcm/channels" expectation');
          },
          function (error) {
            console.log(error.body);
          }
        );

      mockServerClient("localhost", mockserver_port)
        .mockAnyResponse({
          httpRequest: {},
          httpOverrideForwardedRequest: {
            httpRequest: {
              headers: {
                Host: ["mangata-stash-prod-dot-direct-pixel-353917.oa.r.appspot.com"],
              },
              socketAddress: {
                host: "mangata-stash-prod-dot-direct-pixel-353917.oa.r.appspot.com",
                port: 443,
                scheme: "HTTPS",
              },
            },
          },
          priority: -10,
        })
        .then(
          function () {
            console.log("expectation created");
          },
          function (error) {
            console.log(error);
          }
        );
    },
    function (error) {
      console.log(JSON.stringify(error, null, "  "));
    }
  );
