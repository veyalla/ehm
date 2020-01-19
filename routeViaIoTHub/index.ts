import * as pulumi from "@pulumi/pulumi";
import * as azure from "@pulumi/azure";
import * as eventhub from "@pulumi/azure/eventhub";
import * as crypto from "crypto";
import Axios, * as axios from "axios";


// Create an Azure Resource Group
const resourceGroup = new azure.core.ResourceGroup("pulumi", { location: azure.Locations.EastUS });

const testAnalyticsWorkspace = new azure.operationalinsights.AnalyticsWorkspace("test", {
    name: pulumi.interpolate`iotEdgeMetricsLa-${resourceGroup.name}`,
    resourceGroupName: resourceGroup.name,
    retentionInDays: 30,
    sku: "PerGB2018",
});

// Create an Event Hub endpoint to route metrics messages
const ehNamespace = new eventhub.EventHubNamespace("test", {
    resourceGroupName: resourceGroup.name,
    sku: "standard",
});

const metricsEventHub = new eventhub.EventHub("test", {
    resourceGroupName: resourceGroup.name,
    namespaceName: ehNamespace.name,
    partitionCount: 4,
    messageRetention: 7,
});


const testIoTHub = new azure.iot.IoTHub("test", {
    endpoints: [{
        connectionString:
            pulumi.interpolate`${ehNamespace.defaultPrimaryConnectionString};EntityPath=${metricsEventHub.name}`,
        name: "exportMetrics",
        type: "AzureIotHub.EventHub",
    }],
    fallbackRoute: {
        source: "DeviceMessages",
        enabled: true,
        endpointNames: ["events"],
        condition: "true",
    },
    location: resourceGroup.location,
    name: pulumi.interpolate`piothub-${resourceGroup.name}`,
    resourceGroupName: resourceGroup.name,
    routes: [{
        condition: "MessageIdentifier = 'IoTEdgeMetrics'",
        enabled: true,
        endpointNames: ["exportMetrics"],
        name: "metricsRoute",
        source: "DeviceMessages",
    }],
    sku: {
        capacity: 1,
        name: "S1",
        tier: "Standard",
    }
});

const standardPlan = new azure.appservice.Plan("my-appservice", {
    resourceGroupName: resourceGroup.name,
    sku: {
        tier: "Standard",
        size: "S1",
    },
    maximumElasticWorkerCount: 20,
});

metricsEventHub.onEvent("metricsEvent", {
    plan: standardPlan,
    cardinality: "one",
    appSettings: {
        WID: testAnalyticsWorkspace.workspaceId,
        WKEY: testAnalyticsWorkspace.primarySharedKey
    },
    callback: async (context, msg) => {
        const body = JSON.stringify(msg);
        const wId = process.env.WID
        const wKey = process.env.WKEY
        const apiVersion = '2016-04-01';
        let processingDate = new Date().toUTCString();
        let contentLength = Buffer.byteLength(body, 'utf8');
        let stringToSign = 'POST\n' + contentLength + '\napplication/json\nx-ms-date:' + processingDate + '\n/api/logs';
        let signature = crypto.createHmac('sha256', new Buffer(String(wKey), 'base64')).update(stringToSign, 'utf8').digest('base64');
        let authorization = 'SharedKey ' + wId + ':' + signature;

        var headers = {
            "content-type": "application/json",
            "Authorization": authorization,
            "Log-Type": "promMetrics",
            "x-ms-date": processingDate
        };
        const args = {
            headers: headers,
            body: body
        };
        const url = 'https://' + wId + '.ods.opinsights.azure.com/api/logs?api-version=' + apiVersion;
        try {
            const response = await Axios.post(url, body, { headers: headers })
            console.log(`statusCode: ${response.status}`);
            console.log(response);
        } catch (error) {
            // If the promise rejects, an error will be thrown and caught here
            console.log(error);
        }
    }
}); 

